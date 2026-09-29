import { ApiProperty } from '@nestjs/swagger';

export class TransformerDto {
  @ApiProperty({ example: 'DT-001' }) code: string;
  @ApiProperty({ example: 'Malviya Nagar DT 1' }) name: string;
  @ApiProperty({ example: 'F-001' }) feederCode: string;
  @ApiProperty({ example: 100 }) capacityKva: number;
}

export class PaginatedTransformersDto {
  @ApiProperty({ type: [TransformerDto] }) data: TransformerDto[];
  @ApiProperty({ example: 40 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) limit: number;
  @ApiProperty({ example: 2 }) totalPages: number;
}
