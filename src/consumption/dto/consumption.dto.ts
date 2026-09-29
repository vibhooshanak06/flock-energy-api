import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReadingDto {
  @ApiProperty({
    description: 'Reading timestamp in ISO 8601 (converted from portal DD/MM/YYYY HH:mm, assumed IST/UTC+5:30)',
    example: '2026-06-23T18:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Cumulative active energy register (kWh). Subtract consecutive readings for interval consumption.',
    example: 48438.74,
  })
  kwh: number | null;

  @ApiProperty({
    description: 'Cumulative apparent energy register (kVAh).',
    example: 52313.84,
  })
  kvah: number | null;

  @ApiPropertyOptional({
    description: 'R-phase voltage at time of reading (V).',
    example: 226,
  })
  voltR: number | null;
}

export class ConsumptionResponseDto {
  @ApiProperty({ example: 'J100000' }) meterId: string;
  @ApiProperty({
    description:
      'Readings ordered oldest-first. kWh/kVAh are cumulative register values — ' +
      'compute delta between two readings to get interval consumption.',
    type: [ReadingDto],
  })
  readings: ReadingDto[];
  @ApiProperty({ example: 337 }) count: number;
}
