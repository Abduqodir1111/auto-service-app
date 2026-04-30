import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Liveness + readiness probe',
    description:
      'Pings PostgreSQL, Redis, and S3-compatible storage in parallel. Returns 200 when every dependency is reachable, 503 otherwise. Public — no auth required (consumed by UptimeRobot / k8s probes / load balancers).',
  })
  async check(@Res() res: Response) {
    const report = await this.healthService.check();
    const status = report.ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    res.status(status).json(report);
  }
}
