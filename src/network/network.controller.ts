import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NetworkService } from './network.service';
import { BulkExportDto, HierarchyTreeDto } from './dto/network.dto';

@ApiTags('network')
@Controller('network')
export class NetworkController {
  constructor(private readonly networkService: NetworkService) {}

  @Get('hierarchy')
  @ApiOperation({
    summary: 'Get full network hierarchy tree',
    description:
      'Returns the complete 7-level hierarchy (Zone → Circle → Division → Subdivision → ' +
      'Substation → Feeder → DT) reconstructed from meter data, with meter counts at the DT level.',
  })
  @ApiResponse({ status: 200, type: HierarchyTreeDto })
  @ApiResponse({ status: 503, description: 'Portal unavailable' })
  hierarchy(): Promise<HierarchyTreeDto> {
    return this.networkService.hierarchy();
  }

  @Get('export')
  @ApiOperation({
    summary: 'Bulk export all meters',
    description:
      'Returns all meters in a single response with full hierarchy and geo data. ' +
      'Useful for bulk ingestion, local indexing, or building derived datasets. ' +
      'Currently 403 meters — no pagination needed at this scale.',
  })
  @ApiResponse({ status: 200, type: BulkExportDto })
  @ApiResponse({ status: 503, description: 'Portal unavailable' })
  export(): Promise<BulkExportDto> {
    return this.networkService.export();
  }
}
