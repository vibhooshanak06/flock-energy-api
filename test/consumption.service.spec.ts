/**
 * ConsumptionService unit tests
 *
 * Key things to verify:
 *  - Portal DD/MM/YYYY HH:mm timestamps are converted correctly to UTC ISO 8601
 *  - Readings are sorted oldest-first
 *  - String kWh/kVAh/voltR are parsed to numbers (null when unparseable)
 *  - Portal 404 (isNotFound) surfaces as NestJS NotFoundException
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConsumptionService } from '../src/consumption/consumption.service';
import { PortalClientService } from '../src/portal-client/portal-client.service';

const MOCK_ENERGY_RESPONSE = {
  data: [
    // Newer reading first (as portal returns them)
    { timestamp: '24/06/2026 00:00', kwh: '48440.00', kvah: '52315.00', voltR: '228' },
    { timestamp: '23/06/2026 23:30', kwh: '48438.74', kvah: '52313.84', voltR: '226' },
  ],
};

describe('ConsumptionService', () => {
  let service: ConsumptionService;
  let portalClient: { get: jest.Mock };

  beforeEach(async () => {
    portalClient = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumptionService,
        { provide: PortalClientService, useValue: portalClient },
      ],
    }).compile();

    service = module.get(ConsumptionService);
  });

  it('returns readings sorted oldest-first', async () => {
    portalClient.get.mockResolvedValue(MOCK_ENERGY_RESPONSE);

    const result = await service.getReadings('J100000');

    expect(result.readings[0].timestamp < result.readings[1].timestamp).toBe(true);
  });

  it('converts portal timestamp to UTC ISO 8601 (IST = UTC+5:30)', async () => {
    portalClient.get.mockResolvedValue({
      data: [{ timestamp: '23/06/2026 23:30', kwh: '100', kvah: '110', voltR: '230' }],
    });

    const result = await service.getReadings('J100000');

    // 23/06/2026 23:30 IST = 23/06/2026 18:00 UTC
    expect(result.readings[0].timestamp).toBe('2026-06-23T18:00:00.000Z');
  });

  it('parses numeric string fields to numbers', async () => {
    portalClient.get.mockResolvedValue({
      data: [{ timestamp: '23/06/2026 23:30', kwh: '48438.74', kvah: '52313.84', voltR: '226' }],
    });

    const result = await service.getReadings('J100000');

    expect(result.readings[0].kwh).toBe(48438.74);
    expect(result.readings[0].kvah).toBe(52313.84);
    expect(result.readings[0].voltR).toBe(226);
  });

  it('returns null for unparseable numeric fields', async () => {
    portalClient.get.mockResolvedValue({
      data: [{ timestamp: '23/06/2026 23:30', kwh: '', kvah: 'N/A', voltR: '' }],
    });

    const result = await service.getReadings('J100000');

    expect(result.readings[0].kwh).toBeNull();
    expect(result.readings[0].kvah).toBeNull();
    expect(result.readings[0].voltR).toBeNull();
  });

  it('returns meterId and correct count', async () => {
    portalClient.get.mockResolvedValue(MOCK_ENERGY_RESPONSE);

    const result = await service.getReadings('J100000');

    expect(result.meterId).toBe('J100000');
    expect(result.count).toBe(2);
  });

  it('throws NotFoundException when portal signals 404 via isNotFound', async () => {
    const notFoundError: any = new Error('Portal returned 404');
    notFoundError.isNotFound = true;
    portalClient.get.mockRejectedValue(notFoundError);

    await expect(service.getReadings('BADID')).rejects.toThrow(NotFoundException);
  });

  it('propagates non-404 portal errors', async () => {
    portalClient.get.mockRejectedValue(new Error('portal timeout'));

    await expect(service.getReadings('J100000')).rejects.toThrow('portal timeout');
  });
});
