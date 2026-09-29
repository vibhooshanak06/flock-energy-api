/**
 * MetersService unit tests
 *
 * PortalClientService is mocked — no HTTP calls.
 * Tests cover: list pagination mapping, findOne happy path, findOne not-found.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MetersService } from '../src/meters/meters.service';
import { PortalClientService } from '../src/portal-client/portal-client.service';

const MOCK_SEARCH_RESPONSE = {
  data: [
    { meterId: 'J100000', serialNo: 'SE33962', make: 'HPL', phaseType: 'single', installStatus: 'Installed', dtCode: 'DT-001' },
    { meterId: 'J100001', serialNo: 'GE84132', make: 'L&T', phaseType: 'single', installStatus: 'Decommissioned', dtCode: 'DT-002' },
  ],
  total: 2,
};

const MOCK_EXPORT_RESPONSE = {
  data: [
    {
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
    },
  ],
  total: 1,
};

describe('MetersService', () => {
  let service: MetersService;
  let portalClient: { get: jest.Mock; getExport: jest.Mock };

  beforeEach(async () => {
    portalClient = { get: jest.fn(), getExport: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetersService,
        { provide: PortalClientService, useValue: portalClient },
      ],
    }).compile();

    service = module.get(MetersService);
  });

  // ---------------------------------------------------------------------------
  // list()
  // ---------------------------------------------------------------------------

  describe('list()', () => {
    it('returns paginated meter summaries', async () => {
      portalClient.get.mockResolvedValue(MOCK_SEARCH_RESPONSE);

      const result = await service.list({ page: 1, limit: 20 });

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        meterId: 'J100000',
        serialNo: 'SE33962',
        make: 'HPL',
        phaseType: 'single',
        installStatus: 'Installed',
        dtCode: 'DT-001',
      });
    });

    it('passes the search query to the portal client', async () => {
      portalClient.get.mockResolvedValue({ data: [], total: 0 });

      await service.list({ page: 1, limit: 20, q: 'J1001' });

      expect(portalClient.get).toHaveBeenCalledWith(
        '/portal/meters/search',
        expect.objectContaining({ q: 'J1001' }),
      );
    });

    it('uses empty string when q is not provided', async () => {
      portalClient.get.mockResolvedValue({ data: [], total: 0 });

      await service.list({ page: 1, limit: 20 });

      expect(portalClient.get).toHaveBeenCalledWith(
        '/portal/meters/search',
        expect.objectContaining({ q: '' }),
      );
    });

    it('returns empty data array when portal returns no meters', async () => {
      portalClient.get.mockResolvedValue({ data: [], total: 0 });

      const result = await service.list({ page: 1, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne()
  // ---------------------------------------------------------------------------

  describe('findOne()', () => {
    it('returns full detail for a known meter ID', async () => {
      portalClient.getExport.mockResolvedValue(MOCK_EXPORT_RESPONSE);

      const result = await service.findOne('J100000');

      expect(result.meterId).toBe('J100000');
      expect(result.installType).toBe('Whole Current');
      expect(result.build).toBe('legacy');
      expect(result.hierarchy.zone.code).toBe('Z-01');
      expect(result.geo.lat).toBe(26.93);
    });

    it('throws NotFoundException for an unknown meter ID', async () => {
      portalClient.getExport.mockResolvedValue(MOCK_EXPORT_RESPONSE);

      await expect(service.findOne('DOESNOTEXIST')).rejects.toThrow(NotFoundException);
    });

    it('propagates portal errors from getExport()', async () => {
      portalClient.getExport.mockRejectedValue(new Error('portal down'));

      await expect(service.findOne('J100000')).rejects.toThrow('portal down');
    });
  });
});
