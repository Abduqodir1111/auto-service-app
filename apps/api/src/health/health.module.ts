import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [UploadsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
