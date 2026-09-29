/**
 * NetworkService unit tests
 *
 * Verifies that the hierarchy tree is built correctly from flat meter export data.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NetworkService } from '../src/network/network.service';
import { PortalClientService } from '../src/portal-client/portal-client.service';

const makeMeter = (id: string, overrides: Record<string, any> = {}) => ({
  meterId: id,
  serialNo: 'S1',
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
  ...overrides,
});

describe('NetworkService', () => {
  let service: NetworkService;
  let portalClient: { getExport: jest.Mock };

  beforeEach(async () => {
    portalClient = { getExport: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NetworkService,
        { provide: PortalClientService, useValue: portalClient },
      ],
    }).compile();

    service = module.get(NetworkService);
  });

  describe('hierarchy()', () => {
    it('builds a tree with correct zone/circle/dt nesting', async () => {
      portalClient.getExport.mockResolvedValue({
        data: [makeMeter('J100000'), makeMeter('J100001')],
        total: 2,
      });

      const result = await service.hierarchy();

      expect(result.totalMeters).toBe(2);
      expect(result.zones).toHaveLength(1);
      expect(result.zones[0].code).toBe('Z-01');
      expect(result.zones[0].circles).toHaveLength(1);

      const dt = result.zones[0].circles[0].divisions[0].subdivisions[0].substations[0].feeders[0].dts[0];
      expect(dt.code).toBe('DT-001');
      expect(dt.meterCount).toBe(2);
    });

    it('deduplicates nodes that appear in multiple meters', async () => {
      // Three meters, all in the same zone — should produce exactly one zone node
      portalClient.getExport.mockResolvedValue({
        data: [makeMeter('J100000'), makeMeter('J100001'), makeMeter('J100002')],
        total: 3,
      });

      const result = await service.hierarchy();

      expect(result.zones).toHaveLength(1);
      expect(result.zones[0].circles).toHaveLength(1);
    });

    it('handles meters in multiple zones correctly', async () => {
      const zone2Override = {
        hierarchy: {
          zone: { name: 'Zone 2', code: 'Z-02' },
          circle: { name: 'Circle 2', code: 'C-02' },
          division: { name: 'Division 2', code: 'D-02' },
          subdivision: { name: 'Subdivision 2', code: 'SD-02' },
          substation: { name: 'Substation 2', code: 'SS-02' },
          feeder: { name: 'Feeder 2', code: 'F-002' },
          dt: { name: 'DT 2', code: 'DT-002' },
        },
      };

      portalClient.getExport.mockResolvedValue({
        data: [makeMeter('J100000'), makeMeter('J200000', zone2Override)],
        total: 2,
      });

      const result = await service.hierarchy();

      expect(result.zones).toHaveLength(2);
      expect(result.zones.map((z) => z.code).sort()).toEqual(['Z-01', 'Z-02']);
    });

    it('sorts zones by code', async () => {
      const zone2Override = { hierarchy: { zone: { name: 'Zone 2', code: 'Z-02' }, circle: { name: 'C', code: 'C-02' }, division: { name: 'D', code: 'D-02' }, subdivision: { name: 'SD', code: 'SD-02' }, substation: { name: 'SS', code: 'SS-02' }, feeder: { name: 'F', code: 'F-002' }, dt: { name: 'DT', code: 'DT-002' } } };
      const zone1Override = { hierarchy: { zone: { name: 'Zone 1', code: 'Z-01' }, circle: { name: 'C', code: 'C-01' }, division: { name: 'D', code: 'D-01' }, subdivision: { name: 'SD', code: 'SD-01' }, substation: { name: 'SS', code: 'SS-01' }, feeder: { name: 'F', code: 'F-001' }, dt: { name: 'DT', code: 'DT-001' } } };

      // Provide zone 2 first in the data
      portalClient.getExport.mockResolvedValue({
        data: [makeMeter('J200000', zone2Override), makeMeter('J100000', zone1Override)],
        total: 2,
      });

      const result = await service.hierarchy();

      expect(result.zones[0].code).toBe('Z-01');
      expect(result.zones[1].code).toBe('Z-02');
    });
  });

  describe('export()', () => {
    it('returns the raw export data unchanged', async () => {
      const mockData = { data: [makeMeter('J100000')], total: 1 };
      portalClient.getExport.mockResolvedValue(mockData);

      const result = await service.export();

      expect(result.total).toBe(1);
      expect(result.data[0].meterId).toBe('J100000');
    });
  });
});
