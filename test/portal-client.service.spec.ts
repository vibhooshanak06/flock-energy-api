/**
 * PortalClientService unit tests
 *
 * Approach: we don't mock the axios module (that requires matching internal
 * import details exactly). Instead we inject the axios instance directly by
 * exploiting TypeScript's "any" on the private field after construction.
 *
 * This is the clearest pattern for NestJS + axios without using HttpModule:
 *   1. Create the service via the testing module
 *   2. Reach into the private `http` field and replace it with a jest mock object
 *   3. Call onModuleInit() which triggers login — now fully controlled
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { PortalClientService } from '../src/portal-client/portal-client.service';

/** Minimal axios-instance mock */
function makeMockHttp() {
  return {
    post: jest.fn(),
    get: jest.fn(),
  };
}

/** Reusable happy-path login setup */
function setupHappyLogin(http: ReturnType<typeof makeMockHttp>) {
  http.post.mockResolvedValue({
    status: 200,
    data: { type: 'redirect', status: 303, location: '/meters' },
    headers: { 'set-cookie': ['__Secure-better-auth.session_token=tok123; HttpOnly; Secure'] },
  });
  http.get.mockImplementation((url: string) => {
    if (url.includes('/api/auth/get-session')) {
      return Promise.resolve({
        status: 200,
        data: { session: { expiresAt: new Date(Date.now() + 3600_000).toISOString() } },
      });
    }
    if (url.includes('/portal/keys')) {
      return Promise.resolve({
        status: 200,
        data: { data: { signingSecret: 'test-secret-32-chars-exactly!!!!' } },
      });
    }
    return Promise.resolve({ status: 200, data: {} });
  });
}

const MOCK_EXPORT_METER = {
  meterId: 'J100000',
  serialNo: 'SE33962',
  make: 'HPL',
  phaseType: 'single',
  installStatus: 'Installed',
  installType: 'Whole Current',
  build: 'legacy',
  dtCode: 'DT-001',
  hierarchy: {
    zone: { name: 'Zone 1', code: 'Z-01' },
    circle: { name: 'Circle 1', code: 'C-01' },
    division: { name: 'Division 1', code: 'D-01' },
    subdivision: { name: 'Subdivision 1', code: 'SD-01' },
    substation: { name: 'Substation 1', code: 'SS-01' },
    feeder: { name: 'Feeder 1', code: 'F-001' },
    dt: { name: 'DT 1', code: 'DT-001' },
  },
  geo: { lat: 26.93, lng: 75.83 },
};

describe('PortalClientService', () => {
  let service: PortalClientService;
  let http: ReturnType<typeof makeMockHttp>;

  /** Build a fresh service with mock http injected */
  async function buildService(): Promise<PortalClientService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PortalClientService],
    }).compile();
    const svc = module.get(PortalClientService);
    // Replace the private axios instance with our controllable mock
    (svc as any).http = http;
    return svc;
  }

  beforeEach(() => {
    http = makeMockHttp();
  });

  // ---------------------------------------------------------------------------
  // Login / session establishment
  // ---------------------------------------------------------------------------

  describe('login', () => {
    it('logs in with correct SvelteKit form action headers', async () => {
      setupHappyLogin(http);
      service = await buildService();
      await service.onModuleInit();

      expect(http.post).toHaveBeenCalledWith(
        '/login',
        expect.stringContaining('email=operator'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-sveltekit-action': 'true',
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );
    });

    it('stores session and does not re-login on subsequent get() calls', async () => {
      setupHappyLogin(http);
      service = await buildService();
      await service.onModuleInit();

      http.get.mockResolvedValueOnce({ status: 200, data: { result: 'ok' } });
      await service.get('/some/path');

      // post() still called exactly once — no second login
      expect(http.post).toHaveBeenCalledTimes(1);
    });

    it('throws ServiceUnavailableException when login response has wrong type', async () => {
      http.post.mockResolvedValue({
        status: 200,
        data: { type: 'error' },
        headers: {},
      });
      service = await buildService();

      await expect(service.onModuleInit()).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException when login returns no set-cookie header', async () => {
      http.post.mockResolvedValue({
        status: 200,
        data: { type: 'redirect', status: 303, location: '/meters' },
        headers: {}, // no set-cookie
      });
      service = await buildService();

      await expect(service.onModuleInit()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  // ---------------------------------------------------------------------------
  // get()
  // ---------------------------------------------------------------------------

  describe('get()', () => {
    beforeEach(async () => {
      setupHappyLogin(http);
      service = await buildService();
      await service.onModuleInit();
    });

    it('returns parsed JSON data on success', async () => {
      http.get.mockResolvedValueOnce({ status: 200, data: { items: [1, 2, 3] } });

      const result = await service.get<{ items: number[] }>('/portal/meters/search', { q: '', page: '1' });

      expect(result).toEqual({ items: [1, 2, 3] });
    });

    it('re-authenticates once on 401 and retries the original request', async () => {
      // First get call returns 401
      http.get.mockResolvedValueOnce({ status: 401, data: {} });
      // Re-login: post succeeds
      http.post.mockResolvedValueOnce({
        status: 200,
        data: { type: 'redirect', status: 303, location: '/meters' },
        headers: { 'set-cookie': ['__Secure-better-auth.session_token=newtok; HttpOnly'] },
      });
      // After re-login: get-session and keys
      http.get
        .mockResolvedValueOnce({ status: 200, data: { session: { expiresAt: new Date(Date.now() + 3600_000).toISOString() } } })
        .mockResolvedValueOnce({ status: 200, data: { data: { signingSecret: 'new-secret-32-chars-exactly!!!' } } })
        .mockResolvedValueOnce({ status: 200, data: { items: ['retried'] } });

      const result = await service.get<{ items: string[] }>('/portal/meters/search');

      expect(result).toEqual({ items: ['retried'] });
      expect(http.post).toHaveBeenCalledTimes(2); // initial login + re-login
    });

    it('throws ServiceUnavailableException on non-OK, non-401/404 status', async () => {
      http.get.mockResolvedValueOnce({ status: 500, data: {} });

      await expect(service.get('/portal/anything')).rejects.toThrow(ServiceUnavailableException);
    });

    it('sets isNotFound=true on portal 404', async () => {
      http.get.mockResolvedValueOnce({ status: 404, data: {} });

      try {
        await service.get('/portal/meters/DOESNOTEXIST/energy');
        fail('Expected an error');
      } catch (err: any) {
        expect(err.isNotFound).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // getExport()
  // ---------------------------------------------------------------------------

  describe('getExport()', () => {
    beforeEach(async () => {
      setupHappyLogin(http);
      service = await buildService();
      await service.onModuleInit();
    });

    it('sends x-timestamp and x-signature HMAC headers', async () => {
      http.get.mockResolvedValueOnce({
        status: 200,
        data: { data: [MOCK_EXPORT_METER], total: 1 },
      });

      await service.getExport();

      // The last get() call is the export itself
      const lastCall = http.get.mock.calls[http.get.mock.calls.length - 1];
      const headers = lastCall[1]?.headers ?? {};
      expect(headers['x-timestamp']).toMatch(/^\d+$/);
      expect(headers['x-signature']).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns the parsed export data', async () => {
      http.get.mockResolvedValueOnce({
        status: 200,
        data: { data: [MOCK_EXPORT_METER], total: 1 },
      });

      const result: any = await service.getExport();

      expect(result.total).toBe(1);
      expect(result.data[0].meterId).toBe('J100000');
    });
  });
});
