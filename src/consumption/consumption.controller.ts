import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConsumptionService } from './consumption.service';
import { ConsumptionResponseDto } from './dto/consumption.dto';

@ApiTags('consumption')
@Controller('meters/:meterId/consumption')
export class ConsumptionController {
  constructor(private readonly consumptionService: ConsumptionService) {}

  @Get()
  @ApiOperation({
    summary: 'Get meter consumption readings',
    description:
      'Returns the available energy readings for a meter (up to ~337 half-hourly readings). ' +
      'kWh and kVAh are cumulative register values — subtract consecutive readings for interval consumption. ' +
      'Timestamps are ISO 8601 UTC (converted from portal local time, assumed IST/UTC+5:30).',
  })
  @ApiParam({ name: 'meterId', example: 'J100000', description: 'Meter ID' })
  @ApiResponse({ status: 200, type: ConsumptionResponseDto })
  @ApiResponse({ status: 404, description: 'Meter not found' })
  @ApiResponse({ status: 503, description: 'Portal unavailable' })
  getReadings(@Param('meterId') meterId: string): Promise<ConsumptionResponseDto> {
    return this.consumptionService.getReadings(meterId);
  }
}
