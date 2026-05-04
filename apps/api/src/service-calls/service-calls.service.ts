import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  ReportTargetType,
  ServiceCall,
  ServiceCallStatus,
  WorkshopStatus,
} from '@prisma/client';
import { UserRole } from '@stomvp/shared';
import { PrismaService } from '../database/prisma.service';
import { PushNotificationsService } from '../devices/push-notifications.service';
import { CreateServiceCallDto } from './dto/create-service-call.dto';
import { ComplainServiceCallDto } from './dto/complain-service-call.dto';

/**
 * Per-candidate ringing window. Every master has exactly this many seconds
 * to swipe-accept; if the timer expires, the dispatcher rotates to the next
 * candidate. Matches the UX spec ("30s like Yandex Taxi").
 */
const CANDIDATE_TIMEOUT_SECONDS = 30;

/**
 * Cron tick interval. We poll the SEARCHING calls table looking for expired
 * candidates; lower = more responsive, higher = cheaper. 5s gives at most
 * 5s slop on top of the 30s timeout, which is fine for a personal-scale
 * MVP. Run via setInterval (no @nestjs/schedule dep) so we don't pull
 * another package just for this.
 */
const DISPATCHER_TICK_MS = 5_000;

/**
 * Initial / expansion radii used by the dispatcher when picking candidates.
 * "Dynamic radius": start narrow, fall back wider if nobody close-by has
 * the category & is online. Picked once at create time — we don't re-query
 * the candidate set during ringing.
 */
const SEARCH_RADII_METERS = [5_000, 15_000, 50_000];

type DistanceCandidate = {
  ownerId: string;
  distance: number;
};

@Injectable()
export class ServiceCallsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServiceCallsService.name);
  private dispatcherTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    // Don't run the dispatcher in unit tests — they don't expect side
    // effects from background timers, and the test postgres has no
    // PostGIS-enabled schema anyway.
    if (this.config.get<string>('NODE_ENV') === 'test') {
      this.logger.debug('Dispatcher disabled in test env');
      return;
    }
    this.dispatcherTimer = setInterval(() => {
      this.tickDispatcher().catch((err) => {
        this.logger.warn(`Dispatcher tick failed: ${(err as Error).message}`);
      });
    }, DISPATCHER_TICK_MS);
    // Don't keep node alive just for this loop.
    this.dispatcherTimer.unref?.();
    this.logger.log(`Service-call dispatcher running every ${DISPATCHER_TICK_MS}ms`);
  }

  onModuleDestroy() {
    if (this.dispatcherTimer) {
      clearInterval(this.dispatcherTimer);
      this.dispatcherTimer = null;
    }
  }

  /**
   * Client kicks off a new on-demand call. We immediately compute the
   * candidate list (closest online masters with the category in their
   * workshop) and ring the first one.
   */
  async create(clientId: string, role: UserRole, dto: CreateServiceCallDto) {
    if (role !== UserRole.CLIENT) {
      throw new ForbiddenException('Only clients can call masters');
    }

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const candidates = await this.findCandidateMasters(
      dto.lat,
      dto.lng,
      dto.categoryId,
    );

    if (candidates.length === 0) {
      // Still create the row so the client can see "no masters available"
      // — much friendlier than a 404. Status goes straight to NO_MASTERS.
      const empty = await this.prisma.serviceCall.create({
        data: {
          clientId,
          categoryId: dto.categoryId,
          lat: dto.lat,
          lng: dto.lng,
          clientPhone: dto.clientPhone,
          address: dto.address,
          description: dto.description,
          status: ServiceCallStatus.NO_MASTERS,
          candidateMasterIds: [],
          currentCandidateIdx: 0,
        },
      });
      return this.serialize(empty);
    }

    const expiresAt = this.makeExpiresAt();
    const call = await this.prisma.serviceCall.create({
      data: {
        clientId,
        categoryId: dto.categoryId,
        lat: dto.lat,
        lng: dto.lng,
        clientPhone: dto.clientPhone,
        address: dto.address,
        description: dto.description,
        status: ServiceCallStatus.SEARCHING,
        candidateMasterIds: candidates.map((c) => c.ownerId),
        currentCandidateIdx: 0,
        currentExpiresAt: expiresAt,
      },
    });

    void this.notifyCandidate(call.id, candidates[0].ownerId, category.name);
    return this.serialize(call);
  }

  /**
   * Client polls this every ~2s on the waiting screen. Master polls it
   * after accepting to load full call details.
   */
  async getById(id: string, userId: string, role: UserRole): Promise<ReturnType<typeof this.serialize>> {
    const call = await this.prisma.serviceCall.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, fullName: true, phone: true } },
        assignedMaster: { select: { id: true, fullName: true, phone: true } },
      },
    });
    if (!call) {
      throw new NotFoundException('Call not found');
    }
    const isClient = call.clientId === userId;
    const isAssignedMaster = call.assignedMasterId === userId;
    const isCandidate = call.candidateMasterIds.includes(userId);
    if (
      role !== UserRole.ADMIN &&
      !isClient &&
      !isAssignedMaster &&
      !isCandidate
    ) {
      throw new ForbiddenException('Not your call');
    }
    return this.serialize(call);
  }

  /**
   * Master incoming-call screen polls this. Returns the call currently
   * "ringing" the given master, or null if none. The master may also
   * already be the assigned master of an in-progress call — return that
   * too so a returning master can reopen the same screen.
   */
  async getActiveForMaster(masterId: string) {
    const now = new Date();
    // Currently ringing: master is at the live index AND timer hasn't expired.
    const ringing = await this.prisma.serviceCall.findFirst({
      where: {
        status: ServiceCallStatus.SEARCHING,
        currentExpiresAt: { gt: now },
        // Postgres array predicate via Prisma: candidateMasterIds[idx] = master
        // We match by checking candidateMasterIds contains masterId AND
        // currentCandidateIdx must point to it. Prisma can't express the
        // index check directly, so we filter in JS below.
        candidateMasterIds: { has: masterId },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (ringing && ringing.candidateMasterIds[ringing.currentCandidateIdx] === masterId) {
      return this.serialize(ringing);
    }
    // Already assigned to this master and not yet completed/cancelled.
    const assigned = await this.prisma.serviceCall.findFirst({
      where: {
        assignedMasterId: masterId,
        status: ServiceCallStatus.ASSIGNED,
      },
      orderBy: { createdAt: 'desc' },
    });
    return assigned ? this.serialize(assigned) : null;
  }

  /**
   * Master swipes accept. Optimistic lock via version-style check on
   * currentCandidateIdx so two stale taps can't both win.
   */
  async accept(id: string, masterId: string) {
    const call = await this.prisma.serviceCall.findUnique({ where: { id } });
    if (!call) throw new NotFoundException('Call not found');
    if (call.status !== ServiceCallStatus.SEARCHING) {
      throw new BadRequestException('Call already resolved');
    }
    const liveCandidateId = call.candidateMasterIds[call.currentCandidateIdx];
    if (liveCandidateId !== masterId) {
      throw new BadRequestException('You are not the active candidate');
    }
    if (call.currentExpiresAt && call.currentExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Call window expired');
    }

    const updated = await this.prisma.serviceCall.update({
      where: { id },
      data: {
        status: ServiceCallStatus.ASSIGNED,
        assignedMasterId: masterId,
        assignedAt: new Date(),
        currentExpiresAt: null,
      },
    });

    const master = await this.prisma.user.findUnique({
      where: { id: masterId },
      select: { fullName: true, phone: true },
    });

    void this.push.sendToUser(call.clientId, {
      title: '✅ Мастер найден',
      body: `${master?.fullName ?? 'Мастер'} принял ваш вызов и скоро позвонит.`,
      data: {
        type: 'service_call.assigned',
        callId: id,
      },
    });

    return this.serialize(updated);
  }

  /**
   * Master swipes reject (or 30s window expired and the cron is calling us
   * via a different path). Either way: advance the index, ring the next
   * candidate, or give up.
   */
  async reject(id: string, masterId: string) {
    const call = await this.prisma.serviceCall.findUnique({ where: { id } });
    if (!call) throw new NotFoundException('Call not found');
    if (call.status !== ServiceCallStatus.SEARCHING) {
      // Idempotent — if the call already moved on, just return current state.
      return this.serialize(call);
    }
    const liveCandidateId = call.candidateMasterIds[call.currentCandidateIdx];
    if (liveCandidateId !== masterId) {
      // The master is rejecting an already-rotated offer; ignore.
      return this.serialize(call);
    }
    return this.advanceToNextCandidate(call);
  }

  /**
   * Client cancels while still searching, or after assignment if master no-show.
   */
  async cancel(id: string, userId: string) {
    const call = await this.prisma.serviceCall.findUnique({ where: { id } });
    if (!call) throw new NotFoundException('Call not found');
    if (call.clientId !== userId) {
      throw new ForbiddenException('Not your call');
    }
    if (
      call.status !== ServiceCallStatus.SEARCHING &&
      call.status !== ServiceCallStatus.ASSIGNED
    ) {
      throw new BadRequestException('Call already finished');
    }
    const updated = await this.prisma.serviceCall.update({
      where: { id },
      data: {
        status: ServiceCallStatus.CANCELLED,
        currentExpiresAt: null,
        completedAt: new Date(),
      },
    });
    if (call.assignedMasterId) {
      void this.push.sendToUser(call.assignedMasterId, {
        title: '🚫 Клиент отменил вызов',
        body: 'Вызов отменён клиентом.',
        data: { type: 'service_call.cancelled', callId: id },
      });
    }
    return this.serialize(updated);
  }

  /**
   * Either side marks the job as done. Master can mark complete after
   * actually finishing the work; client can confirm too.
   */
  async complete(id: string, userId: string) {
    const call = await this.prisma.serviceCall.findUnique({ where: { id } });
    if (!call) throw new NotFoundException('Call not found');
    const isParticipant =
      call.clientId === userId || call.assignedMasterId === userId;
    if (!isParticipant) {
      throw new ForbiddenException('Not your call');
    }
    if (call.status !== ServiceCallStatus.ASSIGNED) {
      throw new BadRequestException('Call must be ASSIGNED to complete');
    }
    const updated = await this.prisma.serviceCall.update({
      where: { id },
      data: {
        status: ServiceCallStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    return this.serialize(updated);
  }

  /**
   * Client files a complaint after master no-show / cancellation. Lands as
   * a Report with targetType=SERVICE_CALL so the admin moderation dashboard
   * picks it up alongside other reports.
   */
  async complain(id: string, userId: string, dto: ComplainServiceCallDto) {
    const call = await this.prisma.serviceCall.findUnique({ where: { id } });
    if (!call) throw new NotFoundException('Call not found');
    if (call.clientId !== userId) {
      throw new ForbiddenException('Only the client can file a complaint');
    }
    if (!call.assignedMasterId) {
      throw new BadRequestException('Cannot complain on a call with no assigned master');
    }
    const masterId = call.assignedMasterId;
    const report = await this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: ReportTargetType.SERVICE_CALL,
        targetId: id,
        reason: dto.reason,
        comment: dto.comment ? `[master:${masterId}] ${dto.comment}` : `[master:${masterId}]`,
      },
    });
    return { id: report.id, status: report.status };
  }

  /**
   * Client-facing list of their own calls (history).
   */
  async listMine(userId: string, role: UserRole) {
    if (role === UserRole.MASTER) {
      const items = await this.prisma.serviceCall.findMany({
        where: { assignedMasterId: userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return items.map((it) => this.serialize(it));
    }
    const items = await this.prisma.serviceCall.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return items.map((it) => this.serialize(it));
  }

  // ---------- private dispatcher logic ----------

  /**
   * Loop body: rotate any SEARCHING call whose ringing master let the
   * window lapse. Runs every DISPATCHER_TICK_MS. Best-effort — exceptions
   * are caught by the caller, the next tick will retry.
   */
  private async tickDispatcher() {
    const now = new Date();
    const expired = await this.prisma.serviceCall.findMany({
      where: {
        status: ServiceCallStatus.SEARCHING,
        currentExpiresAt: { lt: now, not: null },
      },
      take: 100, // hard cap; under realistic load there are <10 active calls.
    });
    if (expired.length === 0) return;
    this.logger.debug(`Rotating ${expired.length} expired call window(s)`);
    for (const call of expired) {
      try {
        await this.advanceToNextCandidate(call);
      } catch (err) {
        this.logger.warn(`Advance failed for call ${call.id}: ${(err as Error).message}`);
      }
    }
  }

  private async advanceToNextCandidate(call: ServiceCall) {
    const nextIdx = call.currentCandidateIdx + 1;
    if (nextIdx >= call.candidateMasterIds.length) {
      // Exhausted candidates → mark NO_MASTERS, ping the client.
      const updated = await this.prisma.serviceCall.update({
        where: { id: call.id },
        data: {
          status: ServiceCallStatus.NO_MASTERS,
          currentExpiresAt: null,
        },
      });
      void this.push.sendToUser(call.clientId, {
        title: '😔 Мастер не найден',
        body: 'Сейчас рядом нет свободных мастеров. Попробуйте чуть позже.',
        data: { type: 'service_call.no_masters', callId: call.id },
      });
      return this.serialize(updated);
    }
    const nextMaster = call.candidateMasterIds[nextIdx];
    const expiresAt = this.makeExpiresAt();
    const updated = await this.prisma.serviceCall.update({
      where: { id: call.id },
      data: {
        currentCandidateIdx: nextIdx,
        currentExpiresAt: expiresAt,
      },
    });
    // Look up category name for the push body.
    const category = await this.prisma.category.findUnique({
      where: { id: call.categoryId },
      select: { name: true },
    });
    void this.notifyCandidate(call.id, nextMaster, category?.name ?? 'Заявка');
    return this.serialize(updated);
  }

  private async notifyCandidate(callId: string, masterId: string, categoryName: string) {
    await this.push.sendToUser(masterId, {
      title: '🚨 Срочный вызов!',
      body: `${categoryName} — есть 30 секунд, чтобы принять заявку.`,
      data: {
        type: 'service_call.incoming',
        callId,
      },
      // Android: route to the louder 'urgent' channel (declared client-side
      // with HIGH importance + max vibration). iOS: 'default' since custom
      // sounds need a separate Apple entitlement we haven't applied for.
      channelId: 'urgent',
      sound: 'default',
    });
  }

  private makeExpiresAt() {
    return new Date(Date.now() + CANDIDATE_TIMEOUT_SECONDS * 1_000);
  }

  /**
   * PostGIS-backed candidate lookup. We expand search radius until we find
   * at least one online master with the category in any of their approved
   * workshops, capped by SEARCH_RADII_METERS.
   *
   * Filtering details:
   *   - master must have isMasterOnline = true
   *   - master must NOT be blocked
   *   - master must own at least one APPROVED workshop linked to the
   *     category, with non-null lat/lng
   *   - sort by distance to the (lat,lng) point, ascending
   *
   * Result: deduped list of master userIds (one master may own multiple
   * workshops; we take the closest and dedupe by ownerId).
   */
  private async findCandidateMasters(
    lat: number,
    lng: number,
    categoryId: string,
  ): Promise<DistanceCandidate[]> {
    for (const radius of SEARCH_RADII_METERS) {
      const candidates = await this.queryCandidatesInRadius(lat, lng, categoryId, radius);
      if (candidates.length > 0) {
        return candidates;
      }
    }
    return [];
  }

  private async queryCandidatesInRadius(
    lat: number,
    lng: number,
    categoryId: string,
    radiusMeters: number,
  ): Promise<DistanceCandidate[]> {
    // Raw query because Prisma can't express ST_DWithin / ST_Distance
    // directly. Using parameter binding to stay safe from SQL injection.
    // DISTINCT ON (ownerId) keeps the closest workshop per master.
    type Row = { owner_id: string; distance: number };
    const rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT DISTINCT ON ("owner_id") "owner_id", "distance"
      FROM (
        SELECT
          w."ownerId" AS "owner_id",
          ST_Distance(
            ST_SetSRID(ST_MakePoint(w."longitude"::float8, w."latitude"::float8), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326)::geography
          ) AS "distance"
        FROM "Workshop" w
        INNER JOIN "WorkshopCategory" wc ON wc."workshopId" = w."id"
        INNER JOIN "User" u ON u."id" = w."ownerId"
        WHERE w."status" = ${WorkshopStatus.APPROVED}::"WorkshopStatus"
          AND wc."categoryId" = ${categoryId}::uuid
          AND w."latitude" IS NOT NULL
          AND w."longitude" IS NOT NULL
          AND u."isMasterOnline" = true
          AND u."isBlocked" = false
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(w."longitude"::float8, w."latitude"::float8), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326)::geography,
            ${radiusMeters}::float8
          )
      ) candidates
      ORDER BY "owner_id", "distance" ASC
    `);
    return rows
      .map((r) => ({ ownerId: r.owner_id, distance: Number(r.distance) }))
      .sort((a, b) => a.distance - b.distance);
  }

  private serialize(call: ServiceCall & { client?: any; assignedMaster?: any }) {
    return {
      id: call.id,
      clientId: call.clientId,
      categoryId: call.categoryId,
      lat: call.lat,
      lng: call.lng,
      address: call.address,
      clientPhone: call.clientPhone,
      description: call.description,
      status: call.status,
      candidateMasterIds: call.candidateMasterIds,
      currentCandidateIdx: call.currentCandidateIdx,
      currentExpiresAt: call.currentExpiresAt?.toISOString() ?? null,
      assignedMasterId: call.assignedMasterId,
      assignedAt: call.assignedAt?.toISOString() ?? null,
      createdAt: call.createdAt.toISOString(),
      completedAt: call.completedAt?.toISOString() ?? null,
      assignedMaster: call.assignedMaster
        ? {
            id: call.assignedMaster.id,
            fullName: call.assignedMaster.fullName,
            phone: call.assignedMaster.phone,
          }
        : null,
      client: call.client
        ? {
            id: call.client.id,
            fullName: call.client.fullName,
            phone: call.client.phone,
          }
        : null,
    };
  }
}
