import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { UploadsModule } from '../uploads/uploads.module';
import { WorkshopsController } from './workshops.controller';
import { WorkshopsService } from './workshops.service';

@Module({
  imports: [UploadsModule, DevicesModule],
  controllers: [WorkshopsController],
  providers: [WorkshopsService],
  exports: [WorkshopsService],
})
export class WorkshopsModule {}
