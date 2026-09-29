import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MetersService } from './meters.service';
import { MeterListQueryDto } from './dto/meter-list-query.dto';
import { MeterDetailDto, PaginatedMetersDto } from './dto/meter.dto';

@ApiTags('meters')
@Controller('meters')
export class MetersController {
  constructor(private readonly metersService: MetersService) {}

  @Get()
  @ApiOperation({
    summary: 'List meters',
    description:
      'Returns a paginated list of meters. Use `q` to search by meter ID or serial number.',
  })
  @ApiResponse({ status: 200, type: PaginatedMetersDto })
  @ApiResponse({ status: 503, description: 'Portal unavailable' })
  list(@Query() query: MeterListQueryDto): Promise<PaginatedMetersDto> {
    return this.metersService.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get meter detail',
    description:
      'Returns full detail for a single meter: nameplate data, 7-level network hierarchy, and GPS location.',
  })
  @ApiParam({ name: 'id', example: 'J100004', description: 'Meter ID' })
  @ApiResponse({ status: 200, type: MeterDetailDto })
  @ApiResponse({ status: 404, description: 'Meter not found' })
  @ApiResponse({ status: 503, description: 'Portal unavailable' })
  findOne(@Param('id') id: string): Promise<MeterDetailDto> {
    return this.metersService.findOne(id);
  }
}
