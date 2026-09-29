import { Injectable } from '@nestjs/common';
import { PortalClientService } from '../portal-client/portal-client.service';
import {
  BulkExportDto,
  HierarchyTreeDto,
  ZoneNodeDto,
  CircleNodeDto,
  DivisionNodeDto,
  SubdivisionNodeDto,
  SubstationNodeDto,
  FeederNodeDto,
  DtNodeDto,
} from './dto/network.dto';

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
export class NetworkService {
  constructor(private readonly portal: PortalClientService) {}

  async export(): Promise<BulkExportDto> {
    const raw = (await this.portal.getExport()) as PortalExportResponse;
    return { data: raw.data, total: raw.total };
  }

  /**
   * Build a 7-level hierarchy tree from the bulk export.
   *
   * The portal has no dedicated hierarchy endpoint — every meter record carries
   * its full ancestry. We reconstruct the tree by grouping meters bottom-up.
   * Nodes are deduplicated by code. A meterCount is attached at the DT level.
   */
  async hierarchy(): Promise<HierarchyTreeDto> {
    const raw = (await this.portal.getExport()) as PortalExportResponse;
    const meters = raw.data;

    // Use Maps keyed by code to deduplicate naturally
    const zoneMap = new Map<string, { name: string; code: string; circles: Map<string, any> }>();

    for (const m of meters) {
      const h = m.hierarchy;

      // Zone
      if (!zoneMap.has(h.zone.code)) {
        zoneMap.set(h.zone.code, { ...h.zone, circles: new Map() });
      }
      const zone = zoneMap.get(h.zone.code)!;

      // Circle
      if (!zone.circles.has(h.circle.code)) {
        zone.circles.set(h.circle.code, { ...h.circle, divisions: new Map() });
      }
      const circle = zone.circles.get(h.circle.code)!;

      // Division
      if (!circle.divisions.has(h.division.code)) {
        circle.divisions.set(h.division.code, { ...h.division, subdivisions: new Map() });
      }
      const division = circle.divisions.get(h.division.code)!;

      // Subdivision
      if (!division.subdivisions.has(h.subdivision.code)) {
        division.subdivisions.set(h.subdivision.code, { ...h.subdivision, substations: new Map() });
      }
      const subdivision = division.subdivisions.get(h.subdivision.code)!;

      // Substation
      if (!subdivision.substations.has(h.substation.code)) {
        subdivision.substations.set(h.substation.code, { ...h.substation, feeders: new Map() });
      }
      const substation = subdivision.substations.get(h.substation.code)!;

      // Feeder
      if (!substation.feeders.has(h.feeder.code)) {
        substation.feeders.set(h.feeder.code, { ...h.feeder, dts: new Map() });
      }
      const feeder = substation.feeders.get(h.feeder.code)!;

      // DT — track meter count
      if (!feeder.dts.has(h.dt.code)) {
        feeder.dts.set(h.dt.code, { ...h.dt, meterCount: 0 });
      }
      feeder.dts.get(h.dt.code)!.meterCount += 1;
    }

    // Collapse Maps into sorted arrays
    const zones: ZoneNodeDto[] = [...zoneMap.values()]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((z) => ({
        code: z.code,
        name: z.name,
        circles: [...z.circles.values()]
          .sort((a, b) => a.code.localeCompare(b.code))
          .map((c): CircleNodeDto => ({
            code: c.code,
            name: c.name,
            divisions: [...c.divisions.values()]
              .sort((a, b) => a.code.localeCompare(b.code))
              .map((d): DivisionNodeDto => ({
                code: d.code,
                name: d.name,
                subdivisions: [...d.subdivisions.values()]
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .map((sd): SubdivisionNodeDto => ({
                    code: sd.code,
                    name: sd.name,
                    substations: [...sd.substations.values()]
                      .sort((a, b) => a.code.localeCompare(b.code))
                      .map((ss): SubstationNodeDto => ({
                        code: ss.code,
                        name: ss.name,
                        feeders: [...ss.feeders.values()]
                          .sort((a, b) => a.code.localeCompare(b.code))
                          .map((f): FeederNodeDto => ({
                            code: f.code,
                            name: f.name,
                            dts: [...f.dts.values()]
                              .sort((a, b) => a.code.localeCompare(b.code))
                              .map((dt): DtNodeDto => ({
                                code: dt.code,
                                name: dt.name,
                                meterCount: dt.meterCount,
                              })),
                          })),
                      })),
                  })),
              })),
          })),
      }));

    return { zones, totalMeters: meters.length };
  }
}
