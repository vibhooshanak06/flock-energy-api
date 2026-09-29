import { Module } from '@nestjs/common';
import { TransformersController } from './transformers.controller';
import { TransformersService } from './transformers.service';

@Module({
  controllers: [TransformersController],
  providers: [TransformersService],
})
export class TransformersModule {}
