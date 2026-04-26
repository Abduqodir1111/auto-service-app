import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { PushNotificationsService } from './push-notifications.service';

@Module({
  imports: [PrismaModule],
  controllers: [DevicesController],
  providers: [DevicesService, PushNotificationsService],
  exports: [DevicesService, PushNotificationsService],
})
export class DevicesModule {}
