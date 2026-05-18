import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../database/prisma.module';
import { TesterMonitorService } from './tester-monitor.service';

// TelegramClient now comes from the global TelegramModule.
@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  providers: [TesterMonitorService],
  exports: [TesterMonitorService],
})
export class TesterMonitorModule {}
