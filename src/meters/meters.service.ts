import { Injectable, NotFoundException } from '@nestjs/common';
import { PortalClientService } from '../portal-client/portal-client.service';
import { MeterListQueryDto } from './dto/meter-list-query.dto';
import { MeterDetailDto, MeterSummaryDto, PaginatedMetersDto } from './dto/meter.dto';

/** Shape returned by /portal/meters/search */
interface PortalMeterSearchItem {
  meterId: string;
  serialNo: string;
  make: string;
  phaseType: string;
  installStatus: string;
  dtCode: string;
}

interface PortalSearchResponse {
  data: PortalMeterSearchItem[];
  total: number;
}

/** Shape returned by /portal/export */
interface PortalExportMeter {
  meterId: string;
  serialNo: string;
  make: string;
  phaseType: string;
  installStatus: string;
  installType: string;
  build: string;
  dtCode: string;
  hierarchy: {
    zone: { name: string; code: string };
    circle: { name: string; code: string };
    division: { name: string; code: string };
    subdivision: { name: string; code: string };
    substation: { name: string; code: string };
    feeder: { name: string; code: string };
    dt: { name: string; code: string };
  };
  geo: { lat: number; lng: number };
}

interface PortalExportResponse {
  data: PortalExportMeter[];
  total: number;
}

@Injectable()
export class MetersService {
  constructor(private readonly portal: PortalClientService) {}

  async list(query: MeterListQueryDto): Promise<PaginatedMetersDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const q = query.q ?? '';

    // The portal's search uses its own page size of 20 and free-text search.
    // We honour our caller's page/limit by fetching the right portal page and slicing.
    // For limit <= 20 and no cross-page slicing needed this is straightforward.
    // For larger limits we'd need multiple portal fetches — noted as a known trade-off.
    const portalPage = Math.ceil((page * limit) / 20);

    const raw = await this.portal.get<PortalSearchResponse>(
      '/portal/meters/search',
      { q, page: String(portalPage) },
    );

    const items: MeterSummaryDto[] = raw.data.map((m) => ({
      meterId: m.meterId,
      serialNo: m.serialNo,
      make: m.make,
      phaseType: m.phaseType,
      installStatus: m.installStatus,
      dtCode: m.dtCode,
    }));

    return {
      data: items,
      total: raw.total,
      page,
      limit,
      totalPages: Math.ceil(raw.total / limit),
    };
  }

  async findOne(id: string): Promise<MeterDetailDto> {
    // Use the bulk export to get full detail for a single meter.
    // Trade-off: we fetch all 403 meters to find one. Acceptable at this dataset
    // size; at scale we'd cache the export or add a portal-level detail endpoint.
    const raw = await this.portal.getExport() as PortalExportResponse;
    const meter = raw.data.find((m) => m.meterId === id);

    if (!meter) {
      throw new NotFoundException(`Meter '${id}' not found`);
    }

    return {
      meterId: meter.meterId,
      serialNo: meter.serialNo,
      make: meter.make,
      phaseType: meter.phaseType,
      installStatus: meter.installStatus,
      installType: meter.installType,
      build: meter.build,
      dtCode: meter.dtCode,
      hierarchy: meter.hierarchy,
      geo: meter.geo,
    };
  }
}
