import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../database/prisma.module';
import { TelegramClient } from './telegram.client';
import { TesterMonitorService } from './tester-monitor.service';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  providers: [TesterMonitorService, TelegramClient],
  exports: [TesterMonitorService],
})
export class TesterMonitorModule {}
