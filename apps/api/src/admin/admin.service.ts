import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ModerationAction,
  ModerationEntityType,
  PhotoStatus,
  ReviewStatus,
  UserRole,
} from '@prisma/client';
import { PhotoStatus as ApiPhotoStatus } from '@stomvp/shared';
import { PrismaService } from '../database/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import { ReportsService } from '../reports/reports.service';
import { UpdateReportStatusDto } from '../reports/dto/update-report-status.dto';
import { ReviewsService } from '../reviews/reviews.service';
import { UploadsService } from '../uploads/uploads.service';
import { WorkshopsService } from '../workshops/workshops.service';
import { ModerateReviewDto } from '../reviews/dto/moderate-review.dto';
import { ModerateWorkshopDto } from '../workshops/dto/moderate-workshop.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workshopsService: WorkshopsService,
    private readonly reviewsService: ReviewsService,
    private readonly uploadsService: UploadsService,
    private readonly applicationsService: ApplicationsService,
    private readonly reportsService: ReportsService,
  ) {}

  async analytics() {
    const [
      totalUsers,
      totalMasters,
      totalWorkshops,
      pendingWorkshops,
      pendingReviews,
      pendingPhotos,
      pendingReports,
      totalApplications,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.MASTER } }),
      this.prisma.workshop.count(),
      this.prisma.workshop.count({ where: { status: 'PENDING' } }),
      this.prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
      this.prisma.workshopPhoto.count({ where: { status: PhotoStatus.PENDING } }),
      this.prisma.report.count({ where: { status: 'NEW' } }),
      this.prisma.application.count(),
    ]);

    return {
      totalUsers,
      totalMasters,
      totalWorkshops,
      pendingWorkshops,
      pendingReviews,
      pendingPhotos,
      pendingReports,
      totalApplications,
    };
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      isBlocked: user.isBlocked,
      isVerifiedMaster: user.isVerifiedMaster,
      createdAt: user.createdAt.toISOString(),
    }));
  }

  async blockUser(id: string, isBlocked: boolean, actorId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { isBlocked },
      });

      await tx.moderationLog.create({
        data: {
          actorId,
          entityType: ModerationEntityType.USER,
          entityId: id,
          action: isBlocked ? ModerationAction.BLOCKED : ModerationAction.UPDATED,
          fromStatus: user.isBlocked ? 'BLOCKED' : 'ACTIVE',
          toStatus: isBlocked ? 'BLOCKED' : 'ACTIVE',
          note: isBlocked ? 'Пользователь заблокирован' : 'Пользователь разблокирован',
        },
      });

      return updated;
    });
  }

  async verifyMaster(id: string, isVerifiedMaster: boolean, actorId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id },
        data: { isVerifiedMaster },
      });

      await tx.moderationLog.create({
        data: {
          actorId,
          entityType: ModerationEntityType.USER,
          entityId: id,
          action: isVerifiedMaster ? ModerationAction.VERIFIED : ModerationAction.UNVERIFIED,
          fromStatus: user.isVerifiedMaster ? 'VERIFIED' : 'UNVERIFIED',
          toStatus: isVerifiedMaster ? 'VERIFIED' : 'UNVERIFIED',
          note: isVerifiedMaster
            ? 'Мастер отмечен как проверенный'
            : 'Бейдж проверенного мастера снят',
        },
      });

      return nextUser;
    });

    return {
      id: updated.id,
      fullName: updated.fullName,
      phone: updated.phone,
      email: updated.email,
      role: updated.role,
      isBlocked: updated.isBlocked,
      isVerifiedMaster: updated.isVerifiedMaster,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async listWorkshops() {
    return this.workshopsService.listAllAdmin();
  }

  async moderateWorkshop(id: string, dto: ModerateWorkshopDto, actorId?: string) {
    return this.workshopsService.moderate(id, dto, actorId);
  }

  async listReviewsPending() {
    return this.reviewsService.listPending();
  }

  async moderateReview(id: string, dto: ModerateReviewDto, actorId?: string) {
    return this.reviewsService.moderate(id, dto, actorId);
  }

  async listPhotosPending(origin?: string) {
    return this.uploadsService.listPending(origin);
  }

  async moderatePhoto(id: string, status: ApiPhotoStatus, origin?: string, actorId?: string) {
    return this.uploadsService.moderate(id, status, origin, actorId);
  }

  async listApplications() {
    return this.applicationsService.listAll();
  }

  async listReports() {
    return this.reportsService.listAll();
  }

  async updateReportStatus(id: string, dto: UpdateReportStatusDto, actorId?: string) {
    return this.reportsService.updateStatus(id, dto, actorId);
  }

  async listModerationHistory() {
    const logs = await this.prisma.moderationLog.findMany({
      include: {
        actor: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 200,
    });

    return logs.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      note: log.note,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
      actor: log.actor,
    }));
  }

  /**
   * Product-analytics dashboard data — aggregates AnalyticsEvent rows
   * into the shape the admin dashboard renders. All aggregations are
   * SQL-side (Prisma raw / aggregations) so we don't pull millions of
   * rows into Node memory. Public to admin only via guards on controller.
   */
  async getEventsAnalytics() {
    const FUNNEL = [
      'app_opened',
      'signup_started',
      'signup_completed',
      'workshop_viewed',
      'application_created',
    ] as const;

    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Big numbers
    const [
      totalUsers,
      active24hRows,
      active7dRows,
      totalApplications,
      totalEvents,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.analyticsEvent.findMany({
        where: { name: 'app_opened', createdAt: { gte: since24h }, userId: { not: null } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.analyticsEvent.findMany({
        where: { name: 'app_opened', createdAt: { gte: since7d }, userId: { not: null } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.analyticsEvent.count({ where: { name: 'application_created' } }),
      this.prisma.analyticsEvent.count(),
    ]);

    // 2. Funnel (last 7 days) — counts per event in canonical order
    const funnelCounts = await Promise.all(
      FUNNEL.map(async (name) => {
        const count = await this.prisma.analyticsEvent.count({
          where: { name, createdAt: { gte: since7d } },
        });
        return { event: name, count };
      }),
    );

    // 3. Activity by day (last 30 days) — bucket app_opened per UTC day
    const activityByDay = await this.prisma.$queryRaw<
      Array<{ day: Date; count: bigint }>
    >`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
      FROM "AnalyticsEvent"
      WHERE name = 'app_opened' AND "createdAt" >= ${since30d}
      GROUP BY day
      ORDER BY day ASC
    `;

    // 4. Top workshops by views (all-time top 10)
    const topWorkshopsRaw = await this.prisma.$queryRaw<
      Array<{ workshopId: string; views: bigint }>
    >`
      SELECT properties->>'workshopId' AS "workshopId", COUNT(*)::bigint AS views
      FROM "AnalyticsEvent"
      WHERE name = 'workshop_viewed' AND properties ? 'workshopId'
      GROUP BY "workshopId"
      ORDER BY views DESC
      LIMIT 10
    `;

    // Resolve workshop titles. Filter to valid UUIDs only — old test events
    // (e.g. seeded by curl during dev) may have non-UUID workshopIds, and
    // Prisma will throw "Inconsistent column data" if we pass them through.
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const workshopIds = topWorkshopsRaw
      .map((row) => row.workshopId)
      .filter((id): id is string => Boolean(id) && UUID_RE.test(id));
    const workshops = workshopIds.length
      ? await this.prisma.workshop.findMany({
          where: { id: { in: workshopIds } },
          select: { id: true, title: true },
        })
      : [];
    const workshopTitleMap = new Map(workshops.map((w) => [w.id, w.title]));

    const topWorkshops = topWorkshopsRaw.map((row) => ({
      workshopId: row.workshopId,
      title: workshopTitleMap.get(row.workshopId) ?? '(удалена или некорректный ID)',
      views: Number(row.views),
    }));

    // 5. Recent events (last 50, with user names if known)
    const recentRaw = await this.prisma.analyticsEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
      },
    });

    const recentEvents = recentRaw.map((ev) => ({
      id: ev.id,
      name: ev.name,
      properties: ev.properties as Record<string, unknown> | null,
      userId: ev.userId,
      userName: ev.user?.fullName ?? null,
      userPhone: ev.user?.phone ?? null,
      ip: ev.ip,
      userAgent: ev.userAgent,
      createdAt: ev.createdAt.toISOString(),
    }));

    return {
      totals: {
        totalUsers,
        active24h: active24hRows.length,
        active7d: active7dRows.length,
        totalApplications,
        totalEvents,
      },
      funnel: funnelCounts,
      activityByDay: activityByDay.map((row) => ({
        day: row.day.toISOString().slice(0, 10),
        count: Number(row.count),
      })),
      topWorkshops,
      recentEvents,
    };
  }

  /**
   * Per-user activity breakdown for the closed-testing window. Returns one
   * row per non-admin user with: registration date, last seen, total event
   * count, a daily heat-map (last `daysBack` days) and a per-event-name
   * counter. Used by the admin "Activity of testers" page to spot who
   * opted in but never opens the app vs who's actively using it.
   *
   * Note: AnalyticsEvent rows from before sign-up have `userId = null` so
   * they don't show up here. That's fine — we only care about logged-in
   * activity per tester.
   */
  async getTestersActivity(daysBack = 14) {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    // 1. Pull every non-admin user (clients + masters); 12-tester scale
    // makes this trivially small.
    const users = await this.prisma.user.findMany({
      where: { role: { not: 'ADMIN' } },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        isBlocked: true,
        isVerifiedMaster: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (users.length === 0) {
      return { daysBack, days: this.makeDayList(daysBack), users: [] };
    }

    // 2. SQL-side aggregate: per (user, day, eventName) counts. The
    // alternative (Node-side group) would pull every event row.
    const buckets = await this.prisma.$queryRaw<
      Array<{ userId: string; day: string; name: string; cnt: bigint }>
    >`
      SELECT
        "userId",
        to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
        "name",
        COUNT(*)::bigint AS cnt
      FROM "AnalyticsEvent"
      WHERE "userId" IS NOT NULL AND "createdAt" >= ${since}
      GROUP BY "userId", day, "name"
    `;

    // 3. Last seen per user (for the "last activity" column).
    const lastSeenRows = await this.prisma.$queryRaw<
      Array<{ userId: string; lastSeen: Date }>
    >`
      SELECT "userId", MAX("createdAt") AS "lastSeen"
      FROM "AnalyticsEvent"
      WHERE "userId" IS NOT NULL
      GROUP BY "userId"
    `;
    const lastSeenByUser = new Map(
      lastSeenRows.map((row) => [row.userId, row.lastSeen]),
    );

    // 4. Stitch it all together. Building lookup tables once instead of
    // O(n) filter inside the map keeps this O(events + users).
    const bucketByUser = new Map<
      string,
      Array<{ day: string; name: string; cnt: number }>
    >();
    for (const b of buckets) {
      const list = bucketByUser.get(b.userId) ?? [];
      list.push({ day: b.day, name: b.name, cnt: Number(b.cnt) });
      bucketByUser.set(b.userId, list);
    }

    return {
      daysBack,
      days: this.makeDayList(daysBack),
      users: users.map((u) => {
        const items = bucketByUser.get(u.id) ?? [];
        const eventsByDay: Record<string, number> = {};
        const eventsByName: Record<string, number> = {};
        let totalEvents = 0;
        for (const it of items) {
          eventsByDay[it.day] = (eventsByDay[it.day] ?? 0) + it.cnt;
          eventsByName[it.name] = (eventsByName[it.name] ?? 0) + it.cnt;
          totalEvents += it.cnt;
        }
        return {
          id: u.id,
          fullName: u.fullName,
          phone: u.phone,
          role: u.role,
          isBlocked: u.isBlocked,
          isVerifiedMaster: u.isVerifiedMaster,
          createdAt: u.createdAt.toISOString(),
          lastSeenAt: lastSeenByUser.get(u.id)?.toISOString() ?? null,
          totalEvents,
          eventsByDay,
          eventsByName,
        };
      }),
    };
  }

  /** Most-recent-first list of YYYY-MM-DD strings, used as table headers. */
  private makeDayList(daysBack: number): string[] {
    const out: string[] = [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i < daysBack; i++) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }
}
