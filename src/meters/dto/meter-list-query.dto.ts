import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class MeterListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Free-text search — matched against meter ID and serial number',
    example: 'J1001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
