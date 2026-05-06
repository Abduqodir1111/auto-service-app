import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto } from './dto/track-event.dto';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @ApiOperation({
    summary: 'Track a product analytics event',
    description:
      'Public, fire-and-forget. Used by mobile + admin to record signup funnel, workshop views, application creation, etc. Returns 204 even on bogus payload — clients should never block UI on this. Rate-limited to 60 events / minute / IP.',
  })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('event')
  @HttpCode(HttpStatus.NO_CONTENT)
  async track(@Body() dto: TrackEventDto, @Req() req: Request): Promise<void> {
    await this.analytics.track(
      dto,
      req.ip ?? undefined,
      req.headers['user-agent'] ?? undefined,
    );
  }
}
