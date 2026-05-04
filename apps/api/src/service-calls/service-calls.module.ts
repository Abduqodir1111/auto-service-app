import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { ServiceCallsController } from './service-calls.controller';
import { ServiceCallsService } from './service-calls.service';

@Module({
  imports: [DevicesModule],
  controllers: [ServiceCallsController],
  providers: [ServiceCallsService],
  exports: [ServiceCallsService],
})
export class ServiceCallsModule {}
