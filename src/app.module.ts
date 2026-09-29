import { Module } from '@nestjs/common';
import { PortalClientModule } from './portal-client/portal-client.module';
import { MetersModule } from './meters/meters.module';
import { TransformersModule } from './transformers/transformers.module';
import { ConsumptionModule } from './consumption/consumption.module';
import { NetworkModule } from './network/network.module';

@Module({
  imports: [
    PortalClientModule,   // @Global — provides PortalClientService to all feature modules
    MetersModule,
    TransformersModule,
    ConsumptionModule,
    NetworkModule,
  ],
})
export class AppModule {}
