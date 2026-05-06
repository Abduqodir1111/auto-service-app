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
   *
   * When a user-attributed event arrives (userId present), we also
   * back-fill recent ANONYMOUS events from the same (ip, user-agent)
   * combo. This patches the very common "app_opened fired before
   * session hydrated" race so the admin /testers page can credit the
   * full activity to the right user instead of showing them as
   * "никогда не открывал".
   */
  async track(dto: TrackEventDto, ip?: string, userAgent?: string): Promise<void> {
    const trimmedIp = ip ? ip.slice(0, 64) : null;
    const trimmedUa = userAgent ? userAgent.slice(0, 512) : null;
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          name: dto.name,
          properties: (dto.properties ?? null) as Prisma.InputJsonValue,
          userId: dto.userId ?? null,
          ip: trimmedIp,
          userAgent: trimmedUa,
        },
      });

      if (dto.userId && trimmedIp) {
        // Last 30 minutes is generous enough to catch the pre-login
        // app_opened, but tight enough to limit cross-user IP collisions
        // (public Wi-Fi). When userAgent is also known we additionally
        // require it to match — this drops nearly all multi-user
        // collisions to zero in practice.
        const cutoff = new Date(Date.now() - 30 * 60 * 1000);
        const where: Prisma.AnalyticsEventWhereInput = {
          userId: null,
          ip: trimmedIp,
          createdAt: { gte: cutoff },
        };
        if (trimmedUa) where.userAgent = trimmedUa;
        await this.prisma.analyticsEvent.updateMany({
          where,
          data: { userId: dto.userId },
        });
      }
    } catch (err) {
      this.logger.debug(`analytics.track('${dto.name}') failed: ${(err as Error).message}`);
    }
  }
}
