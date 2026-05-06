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
        await this.backfillRecentAnonymous(dto.userId, trimmedIp, trimmedUa);
      }
    } catch (err) {
      this.logger.debug(`analytics.track('${dto.name}') failed: ${(err as Error).message}`);
    }
  }

  /**
   * Two-pass attribution of recent anonymous events to a known user:
   *
   *   Pass 1 — exact IP + (optional) user-agent within last 30 minutes.
   *   Catches the obvious "app_opened fired before session hydrated" case.
   *
   *   Pass 2 — same /24 subnet + same user-agent + this user has prior
   *   history on the same /24 in the last 7 days. Catches small
   *   IP shuffles within a single ISP customer block. We deliberately
   *   DON'T go wider (/16) on Uzbek mobile carriers like Beeline because
   *   they pool hundreds of unrelated subscribers under the same /16,
   *   which causes false positives where one tester's app_opened gets
   *   credited to another tester sharing the carrier.
   *
   * For precise mobile attribution we'd need a stable device fingerprint
   * shipped from the client (planned for the production app). Until
   * then, this is best-effort and may leave a few app_opens unmatched —
   * the alternative (cross-user collisions) is worse than under-counts.
   */
  private async backfillRecentAnonymous(
    userId: string,
    ip: string,
    ua: string | null,
  ): Promise<void> {
    const recentCutoff = new Date(Date.now() - 30 * 60 * 1000);

    // Pass 1 — exact IP + UA
    const exact: Prisma.AnalyticsEventWhereInput = {
      userId: null,
      ip,
      createdAt: { gte: recentCutoff },
    };
    if (ua) exact.userAgent = ua;
    await this.prisma.analyticsEvent.updateMany({ where: exact, data: { userId } });

    // Pass 2 — /24 subnet match (only if we have a UA)
    if (!ua) return;
    const slash24 = subnetSlash24(ip);
    if (!slash24) return;

    // Confirm this user has history on this /24 in the last 7 days.
    // Tighter window than the original 30 days — IP-pool churn is too
    // fast on mobile to trust month-old fingerprints.
    const historyCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const hasHistory = await this.prisma.analyticsEvent.count({
      where: {
        userId,
        userAgent: ua,
        createdAt: { gte: historyCutoff },
        ip: { startsWith: slash24 + '.' },
      },
      take: 1,
    });
    if (hasHistory === 0) return;

    const candidates = await this.prisma.analyticsEvent.findMany({
      where: {
        userId: null,
        userAgent: ua,
        createdAt: { gte: recentCutoff },
        ip: { startsWith: slash24 + '.' },
      },
      select: { id: true },
    });
    if (candidates.length === 0) return;

    await this.prisma.analyticsEvent.updateMany({
      where: { id: { in: candidates.map((c) => c.id) } },
      data: { userId },
    });
  }
}

function subnetSlash24(ip: string): string | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}
