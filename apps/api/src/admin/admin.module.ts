import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { UploadsModule } from '../uploads/uploads.module';
import { WorkshopsModule } from '../workshops/workshops.module';
import { ReportsModule } from '../reports/reports.module';
import { TesterMonitorModule } from '../tester-monitor/tester-monitor.module';
import { SupportModule } from '../support/support.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    WorkshopsModule,
    ReviewsModule,
    UploadsModule,
    ApplicationsModule,
    ReportsModule,
    TesterMonitorModule,
    SupportModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
