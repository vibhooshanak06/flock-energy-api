import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HierarchyNodeDto {
  @ApiProperty({ example: 'Jaipur Zone 1' }) name: string;
  @ApiProperty({ example: 'Z-01' }) code: string;
}

export class MeterHierarchyDto {
  @ApiProperty({ type: HierarchyNodeDto }) zone: HierarchyNodeDto;
  @ApiProperty({ type: HierarchyNodeDto }) circle: HierarchyNodeDto;
  @ApiProperty({ type: HierarchyNodeDto }) division: HierarchyNodeDto;
  @ApiProperty({ type: HierarchyNodeDto }) subdivision: HierarchyNodeDto;
  @ApiProperty({ type: HierarchyNodeDto }) substation: HierarchyNodeDto;
  @ApiProperty({ type: HierarchyNodeDto }) feeder: HierarchyNodeDto;
  @ApiProperty({ type: HierarchyNodeDto }) dt: HierarchyNodeDto;
}

export class MeterGeoDto {
  @ApiProperty({ example: 26.938 }) lat: number;
  @ApiProperty({ example: 75.83 }) lng: number;
}

export class MeterSummaryDto {
  @ApiProperty({ example: 'J100000' }) meterId: string;
  @ApiProperty({ example: 'SE33962' }) serialNo: string;
  @ApiProperty({ example: 'HPL' }) make: string;
  @ApiProperty({ example: 'single', enum: ['single', 'three'] }) phaseType: string;
  @ApiProperty({ example: 'Installed', enum: ['Installed', 'Decommissioned', 'Faulty'] })
  installStatus: string;
  @ApiProperty({ example: 'DT-001' }) dtCode: string;
}

export class MeterDetailDto extends MeterSummaryDto {
  @ApiProperty({ example: 'Whole Current', enum: ['Whole Current', 'CT Operated'] })
  installType: string;
  @ApiProperty({ example: 'legacy', enum: ['legacy', 'v2'] }) build: string;
  @ApiProperty({ type: MeterHierarchyDto }) hierarchy: MeterHierarchyDto;
  @ApiProperty({ type: MeterGeoDto }) geo: MeterGeoDto;
}

export class PaginatedMetersDto {
  @ApiProperty({ type: [MeterSummaryDto] }) data: MeterSummaryDto[];
  @ApiProperty({ example: 403 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) limit: number;
  @ApiProperty({ example: 21 }) totalPages: number;
}
