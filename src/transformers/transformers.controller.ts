import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TransformersService } from './transformers.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PaginatedTransformersDto } from './dto/transformer.dto';

@ApiTags('transformers')
@Controller('transformers')
export class TransformersController {
  constructor(private readonly transformersService: TransformersService) {}

  @Get()
  @ApiOperation({
    summary: 'List distribution transformers',
    description: 'Returns a paginated list of distribution transformers (DTs).',
  })
  @ApiResponse({ status: 200, type: PaginatedTransformersDto })
  @ApiResponse({ status: 503, description: 'Portal unavailable' })
  list(@Query() query: PaginationQueryDto): Promise<PaginatedTransformersDto> {
    return this.transformersService.list(query);
  }
}
