import { Injectable, NotFoundException } from '@nestjs/common';
import { PortalClientService } from '../portal-client/portal-client.service';
import { ConsumptionResponseDto, ReadingDto } from './dto/consumption.dto';

interface PortalReading {
  timestamp: string; // "DD/MM/YYYY HH:mm"
  kwh: string;
  kvah: string;
  voltR: string;
}

interface PortalEnergyResponse {
  data: PortalReading[];
}

@Injectable()
export class ConsumptionService {
  constructor(private readonly portal: PortalClientService) { }

  async getReadings(meterId: string): Promise<ConsumptionResponseDto> {
    let raw: PortalEnergyResponse;

    try {
      raw = await this.portal.get<PortalEnergyResponse>(
        `/portal/meters/${meterId}/energy`,
      );
    } catch (err: any) {
      if (err.isNotFound) {
        throw new NotFoundException(`Meter '${meterId}' not found`);
      }
      throw err;
    }

    const readings: ReadingDto[] = raw.data
      .map((r) => ({
        timestamp: this.parsePortalTimestamp(r.timestamp),
        kwh: this.parseFloat(r.kwh),
        kvah: this.parseFloat(r.kvah),
        voltR: this.parseFloat(r.voltR),
      }))
      // Sort oldest-first so consumers can diff consecutive readings
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return { meterId, readings, count: readings.length };
  }

  /**
   * Convert portal timestamp "DD/MM/YYYY HH:mm" to ISO 8601 UTC.
   *
   * The portal provides no timezone. Based on geography (Jaipur, India) these are
   * IST (UTC+5:30). We subtract 5h30m to produce UTC ISO strings.
   * Documented as an assumption in PROTOCOL.md.
   */
  private parsePortalTimestamp(raw: string): string {
    // raw format: "23/06/2026 23:30"
    const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
    if (!match) {
      // If format is unexpected, return the raw value so we don't silently drop data
      return raw;
    }
    const [, dd, mm, yyyy, hh, min] = match;
    // Interpret as IST (UTC+05:30): subtract 5h30m = 19800 seconds
    const istMs = Date.UTC(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
    );
    const utcMs = istMs - 5.5 * 60 * 60 * 1000;
    return new Date(utcMs).toISOString();
  }

  private parseFloat(val: string): number | null {
    if (val === null || val === undefined || val.trim() === '') return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  }
}
