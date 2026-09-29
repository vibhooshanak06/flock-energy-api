import { ApiProperty } from '@nestjs/swagger';

// ---------------------------------------------------------------------------
// Bulk export DTO
// ---------------------------------------------------------------------------

export class ExportMeterDto {
  @ApiProperty({ example: 'J100000' }) meterId: string;
  @ApiProperty({ example: 'SE33962' }) serialNo: string;
  @ApiProperty({ example: 'HPL' }) make: string;
  @ApiProperty({ example: 'single' }) phaseType: string;
  @ApiProperty({ example: 'Decommissioned' }) installStatus: string;
  @ApiProperty({ example: 'Whole Current' }) installType: string;
  @ApiProperty({ example: 'legacy', enum: ['legacy', 'v2'] }) build: string;
  @ApiProperty({ example: 'DT-001' }) dtCode: string;
  @ApiProperty() hierarchy: Record<string, { name: string; code: string }>;
  @ApiProperty({ example: { lat: 26.938, lng: 75.83 } }) geo: { lat: number; lng: number };
}

export class BulkExportDto {
  @ApiProperty({ type: [ExportMeterDto] }) data: ExportMeterDto[];
  @ApiProperty({ example: 403 }) total: number;
}

// ---------------------------------------------------------------------------
// Hierarchy tree DTO
// ---------------------------------------------------------------------------

export class DtNodeDto {
  @ApiProperty({ example: 'DT-001' }) code: string;
  @ApiProperty({ example: 'Malviya Nagar DT 1' }) name: string;
  @ApiProperty({ example: 3 }) meterCount: number;
}

export class FeederNodeDto {
  @ApiProperty({ example: 'F-001' }) code: string;
  @ApiProperty({ example: 'Feeder 1' }) name: string;
  @ApiProperty({ type: [DtNodeDto] }) dts: DtNodeDto[];
}

export class SubstationNodeDto {
  @ApiProperty({ example: 'SS-01' }) code: string;
  @ApiProperty({ example: 'Substation 1' }) name: string;
  @ApiProperty({ type: [FeederNodeDto] }) feeders: FeederNodeDto[];
}

export class SubdivisionNodeDto {
  @ApiProperty({ example: 'SD-01' }) code: string;
  @ApiProperty({ example: 'Subdivision 1' }) name: string;
  @ApiProperty({ type: [SubstationNodeDto] }) substations: SubstationNodeDto[];
}

export class DivisionNodeDto {
  @ApiProperty({ example: 'D-01' }) code: string;
  @ApiProperty({ example: 'Division 1' }) name: string;
  @ApiProperty({ type: [SubdivisionNodeDto] }) subdivisions: SubdivisionNodeDto[];
}

export class CircleNodeDto {
  @ApiProperty({ example: 'C-01' }) code: string;
  @ApiProperty({ example: 'Circle 1' }) name: string;
  @ApiProperty({ type: [DivisionNodeDto] }) divisions: DivisionNodeDto[];
}

export class ZoneNodeDto {
  @ApiProperty({ example: 'Z-01' }) code: string;
  @ApiProperty({ example: 'Jaipur Zone 1' }) name: string;
  @ApiProperty({ type: [CircleNodeDto] }) circles: CircleNodeDto[];
}

export class HierarchyTreeDto {
  @ApiProperty({ type: [ZoneNodeDto] }) zones: ZoneNodeDto[];
  @ApiProperty({ example: 403 }) totalMeters: number;
}
