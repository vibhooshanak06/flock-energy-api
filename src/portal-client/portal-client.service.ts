/**
 * PortalClientService
 *
 * Single responsibility: talk to the Urja Meter Ops portal.
 * Handles login, session cookie management, proactive re-auth on expiry,
 * HMAC signing for the export endpoint, and raw GET proxying.
 *
 * No business logic lives here — callers receive plain parsed JSON.
 *
 * Design decisions:
 *  - axios for HTTP (cleaner than raw https.request, already a dep of NestJS)
 *  - Session stored in memory (acceptable for a single-process service;
 *    for horizontal scale you'd put it in Redis)
 *  - loginMutex serialises concurrent boot calls so we never double-login
 *  - On 401/403 from portal we clear state and retry once, then surface a 503
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as crypto from 'crypto';
import { URLSearchParams } from 'url';

const PORTAL_BASE = process.env.PORTAL_BASE_URL ?? 'https://urja-ops.flockenergy.tech';

interface Session {
  cookie: string;      // value to pass as Cookie header
  expiresAt: Date;
  signingSecret: string;
}

@Injectable()
export class PortalClientService implements OnModuleInit {
  private readonly logger = new Logger(PortalClientService.name);
  private session: Session | null = null;
  private loginMutex: Promise<void> | null = null;

  /** Underlying axios instance – no default cookie jar, we manage cookies manually */
  private readonly http: AxiosInstance = axios.create({
    baseURL: PORTAL_BASE,
    timeout: 15_000,
    maxRedirects: 0,          // we don't want axios to follow SvelteKit redirects
    validateStatus: () => true, // we inspect status ourselves
  });

  async onModuleInit() {
    await this.ensureSession();
  }

  // ---------------------------------------------------------------------------
  // Session management
  // ---------------------------------------------------------------------------

  /**
   * Ensure a valid session exists. Serialises concurrent callers so only one
   * login attempt is in-flight at a time.
   */
  async ensureSession(): Promise<void> {
    // Still valid with ≥2 min headroom
    if (this.session && this.session.expiresAt > new Date(Date.now() + 2 * 60_000)) {
      return;
    }
    if (this.loginMutex) {
      await this.loginMutex;
      return;
    }
    this.loginMutex = this.login().finally(() => { this.loginMutex = null; });
    await this.loginMutex;
  }

  private async login(): Promise<void> {
    const email = process.env.PORTAL_EMAIL ?? 'operator@urja.local';
    const password = process.env.PORTAL_PASSWORD ?? 'urja-ops-2026';

    this.logger.log('Logging in to portal…');

    const body = new URLSearchParams({ email, password }).toString();

    // SvelteKit form action — must include x-sveltekit-action and Origin headers
    // to pass CSRF guard, and receive JSON back instead of an HTML redirect.
    const loginRes = await this.http.post('/login', body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'x-sveltekit-action': 'true',
        'Origin': PORTAL_BASE,
      },
    });

    if (loginRes.status !== 200 || loginRes.data?.type !== 'redirect') {
      throw new ServiceUnavailableException(
        `Portal login failed (HTTP ${loginRes.status}): ${JSON.stringify(loginRes.data)}`,
      );
    }

    // Extract session cookie — better-auth sets __Secure-better-auth.session_token
    const setCookieHeader = loginRes.headers['set-cookie'];
    if (!setCookieHeader || setCookieHeader.length === 0) {
      throw new ServiceUnavailableException('Portal login succeeded but returned no session cookie');
    }
    const rawCookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
    // Only send the name=value part, not the flags (HttpOnly, Secure, etc.)
    const cookieValue = rawCookie.split(';')[0].trim();

    // Verify session is live and parse expiry
    let expiresAt = new Date(Date.now() + 55 * 60_000); // conservative fallback
    try {
      const sessionRes = await this.http.get('/api/auth/get-session', {
        headers: { Cookie: cookieValue },
      });
      if (sessionRes.status === 200 && sessionRes.data?.session?.expiresAt) {
        expiresAt = new Date(sessionRes.data.session.expiresAt);
      }
    } catch {
      // Non-fatal — we'll use the fallback expiry
    }

    // Fetch HMAC signing secret (needed for /portal/export)
    const keysRes = await this.http.get('/portal/keys', {
      headers: { Cookie: cookieValue },
    });
    if (keysRes.status !== 200) {
      throw new ServiceUnavailableException('Portal returned error fetching signing secret');
    }
    const signingSecret: string = keysRes.data.data.signingSecret;

    this.session = { cookie: cookieValue, expiresAt, signingSecret };
    this.logger.log(`Session OK — expires ${expiresAt.toISOString()}`);
  }

  // ---------------------------------------------------------------------------
  // HMAC signing (portal/export only)
  // ---------------------------------------------------------------------------

  /**
   * Portal export endpoint requires HMAC-SHA-256 over:
   *   METHOD\nPATH\nQUERY_STRING\nUNIX_TIMESTAMP_SECONDS
   * Headers: x-timestamp, x-signature
   */
  private signRequest(
    method: string,
    path: string,
    queryString: string,
  ): Record<string, string> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const message = [method, path, queryString, timestamp].join('\n');
    const signature = crypto
      .createHmac('sha256', this.session!.signingSecret)
      .update(message)
      .digest('hex');
    return { 'x-timestamp': timestamp, 'x-signature': signature };
  }

  // ---------------------------------------------------------------------------
  // Public API used by feature modules
  // ---------------------------------------------------------------------------

  /**
   * GET a portal endpoint. Handles 401/403 by re-logging in once.
   */
  async get<T = unknown>(path: string, query?: Record<string, string>): Promise<T> {
    await this.ensureSession();

    const params = query ? new URLSearchParams(query).toString() : '';
    const url = params ? `${path}?${params}` : path;

    const res = await this.http.get<T>(url, {
      headers: { Cookie: this.session!.cookie },
    });

    if (res.status === 401 || res.status === 403) {
      this.logger.warn(`Got ${res.status} from portal — re-authenticating`);
      this.session = null;
      await this.ensureSession();
      const retry = await this.http.get<T>(url, {
        headers: { Cookie: this.session!.cookie },
      });
      this.assertOk(retry.status, url);
      return retry.data;
    }

    this.assertOk(res.status, url);
    return res.data;
  }

  /**
   * GET /portal/export with HMAC-signed headers.
   */
  async getExport(): Promise<unknown> {
    await this.ensureSession();

    const qs = 'page=1';
    const hmac = this.signRequest('GET', '/portal/export', qs);

    const res = await this.http.get(`/portal/export?${qs}`, {
      headers: { Cookie: this.session!.cookie, ...hmac },
    });

    if (res.status === 401 || res.status === 403) {
      this.logger.warn(`Got ${res.status} from portal export — re-authenticating`);
      this.session = null;
      await this.ensureSession();
      const hmac2 = this.signRequest('GET', '/portal/export', qs);
      const retry = await this.http.get(`/portal/export?${qs}`, {
        headers: { Cookie: this.session!.cookie, ...hmac2 },
      });
      this.assertOk(retry.status, '/portal/export');
      return retry.data;
    }

    this.assertOk(res.status, '/portal/export');
    return res.data;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private assertOk(status: number, url: string): void {
    if (status === 404) {
      // Let callers surface this as a 404 — throw a plain Error, not ServiceUnavailable
      const err: any = new Error(`Portal returned 404 for ${url}`);
      err.isNotFound = true;
      throw err;
    }
    if (status < 200 || status >= 300) {
      throw new ServiceUnavailableException(
        `Portal returned unexpected status ${status} for ${url}`,
      );
    }
  }
}
