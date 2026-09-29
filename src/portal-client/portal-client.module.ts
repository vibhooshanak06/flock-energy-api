import { Global, Module } from '@nestjs/common';
import { PortalClientService } from './portal-client.service';

@Global()
@Module({
  providers: [PortalClientService],
  exports: [PortalClientService],
})
export class PortalClientModule {}
