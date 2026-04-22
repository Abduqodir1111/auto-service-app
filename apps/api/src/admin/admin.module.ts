import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { UploadsModule } from '../uploads/uploads.module';
import { WorkshopsModule } from '../workshops/workshops.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [WorkshopsModule, ReviewsModule, UploadsModule, ApplicationsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
