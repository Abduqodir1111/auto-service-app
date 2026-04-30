import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TrackEventDto } from './dto/track-event.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an event. Fire-and-forget by design — a flaky DB or invalid
   * caller payload must NEVER break the user flow that emitted the event.
   * Failures are logged at debug level only.
   */
  async track(dto: TrackEventDto, ip?: string, userAgent?: string): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          name: dto.name,
          properties: (dto.properties ?? null) as Prisma.InputJsonValue,
          userId: dto.userId ?? null,
          ip: ip ? ip.slice(0, 64) : null,
          userAgent: userAgent ? userAgent.slice(0, 512) : null,
        },
      });
    } catch (err) {
      this.logger.debug(`analytics.track('${dto.name}') failed: ${(err as Error).message}`);
    }
  }
}
