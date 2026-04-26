import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ModerationAction,
  ModerationEntityType,
  PhotoStatus,
  Prisma,
  ReviewStatus,
  WorkshopStatus,
} from '@prisma/client';
import { UserRole } from '@stomvp/shared';
import { Request } from 'express';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UploadsService } from '../uploads/uploads.service';
import { getRequestOrigin, buildUploadsProxyUrl } from '../uploads/uploads.utils';
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { ListWorkshopsQueryDto } from './dto/list-workshops-query.dto';
import { ModerateWorkshopDto } from './dto/moderate-workshop.dto';
import { UpdateWorkshopDto } from './dto/update-workshop.dto';

const WORKSHOP_PUBLIC_CACHE_PREFIX = 'workshops:public:';

@Injectable()
export class WorkshopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly uploadsService: UploadsService,
  ) {}

  async listPublic(
    query: ListWorkshopsQueryDto,
    request?: Request,
    user?: { sub: string; role: UserRole },
  ) {
    if (typeof query.lat === 'number' && typeof query.lng === 'number') {
      return this.listPublicGeo(query, request, user);
    }

    const origin = getRequestOrigin(request);
    const canUseSharedCache = !user?.sub;
    const cacheKey = `${WORKSHOP_PUBLIC_CACHE_PREFIX}${origin ?? 'default'}:${JSON.stringify(query)}`;
    const cached = canUseSharedCache ? await this.redisService.getJson(cacheKey) : null;

    if (cached) {
      return cached;
    }

    const { page, pageSize, search, city, categoryId } = query;
    const where: Prisma.WorkshopWhereInput = {
      status: WorkshopStatus.APPROVED,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
      ...(categoryId
        ? {
            categories: {
              some: {
                categoryId,
              },
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.workshop.findMany({
        where,
        orderBy: [{ favoritesCount: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: this.summaryInclude(user?.sub),
      }),
      this.prisma.workshop.count({ where }),
    ]);

    const payload = {
      data: items.map((workshop) => this.serializeSummary(workshop, origin)),
      meta: {
        total,
        page,
        pageSize,
        pageCount: Math.ceil(total / pageSize),
      },
    };

    if (canUseSharedCache) {
      await this.redisService.setJson(cacheKey, payload, 60);
    }

    return payload;
  }

  private async listPublicGeo(
    query: ListWorkshopsQueryDto,
    request?: Request,
    user?: { sub: string; role: UserRole },
  ) {
    const { page, pageSize, search, city, categoryId } = query;
    const lat = query.lat as number;
    const lng = query.lng as number;
    const radius = query.radius ?? 50000;
    const offset = (page - 1) * pageSize;

    const searchPattern = search ? `%${search}%` : null;
    const cityPattern = city ? `%${city}%` : null;

    const searchFragment = searchPattern
      ? Prisma.sql`AND (w.title ILIKE ${searchPattern} OR w.description ILIKE ${searchPattern})`
      : Prisma.empty;
    const cityFragment = cityPattern
      ? Prisma.sql`AND w.city ILIKE ${cityPattern}`
      : Prisma.empty;
    const categoryFragment = categoryId
      ? Prisma.sql`AND EXISTS (SELECT 1 FROM "WorkshopCategory" wc WHERE wc."workshopId" = w.id AND wc."categoryId" = ${categoryId}::uuid)`
      : Prisma.empty;

    const idRows = await this.prisma.$queryRaw<Array<{ id: string; distance_m: number }>>(Prisma.sql`
      SELECT
        w.id,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(w.longitude::float8, w.latitude::float8), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326)::geography
        )::float8 AS distance_m
      FROM "Workshop" w
      WHERE w.status = 'APPROVED'::"WorkshopStatus"
        AND w.latitude IS NOT NULL
        AND w.longitude IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(w.longitude::float8, w.latitude::float8), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326)::geography,
          ${radius}::float8
        )
        ${searchFragment}
        ${cityFragment}
        ${categoryFragment}
      ORDER BY distance_m ASC
      LIMIT ${pageSize}::int OFFSET ${offset}::int
    `);

    const totalRows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "Workshop" w
      WHERE w.status = 'APPROVED'::"WorkshopStatus"
        AND w.latitude IS NOT NULL
        AND w.longitude IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(w.longitude::float8, w.latitude::float8), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326)::geography,
          ${radius}::float8
        )
        ${searchFragment}
        ${cityFragment}
        ${categoryFragment}
    `);
    const total = Number(totalRows[0]?.count ?? 0);
    const origin = getRequestOrigin(request);

    if (idRows.length === 0) {
      return {
        data: [],
        meta: {
          total,
          page,
          pageSize,
          pageCount: Math.ceil(total / pageSize),
        },
      };
    }

    const ids = idRows.map((row) => row.id);
    const distanceById = new Map(idRows.map((row) => [row.id, Number(row.distance_m)]));

    const workshops = await this.prisma.workshop.findMany({
      where: { id: { in: ids } },
      include: this.summaryInclude(user?.sub),
    });

    const ordered = ids
      .map((id) => workshops.find((w) => w.id === id))
      .filter((w): w is NonNullable<typeof w> => Boolean(w));

    return {
      data: ordered.map((workshop) => {
        const distance = distanceById.get(workshop.id);
        return {
          ...this.serializeSummary(workshop, origin),
          distanceMeters: distance != null ? Math.round(distance) : null,
        };
      }),
      meta: {
        total,
        page,
        pageSize,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  async getDetails(
    id: string,
    user?: { sub: string; role: UserRole },
    request?: Request,
  ) {
    const workshop = await this.prisma.workshop.findUnique({
      where: { id },
      include: this.detailInclude(user?.role === UserRole.ADMIN || false, user?.sub),
    });

    if (!workshop) {
      throw new NotFoundException('Workshop not found');
    }

    const isOwner = user?.sub === workshop.ownerId;
    const canViewNonPublic = isOwner || user?.role === UserRole.ADMIN;

    if (workshop.status !== WorkshopStatus.APPROVED && !canViewNonPublic) {
      throw new NotFoundException('Workshop not found');
    }

    const favorite = user
      ? await this.prisma.favorite.findUnique({
          where: {
            userId_workshopId: {
              userId: user.sub,
              workshopId: id,
            },
          },
          select: {
            id: true,
          },
        })
      : null;

    return this.serializeDetails(
      {
        ...workshop,
        isFavorite: Boolean(favorite),
      },
      getRequestOrigin(request),
    );
  }

  async getMine(userId: string, request?: Request) {
    const workshops = await this.prisma.workshop.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: 'desc' },
      include: this.detailInclude(true, userId),
    });

    const origin = getRequestOrigin(request);
    return workshops.map((workshop) => this.serializeDetails(workshop, origin));
  }

  async createDraft(ownerId: string, request?: Request) {
    const workshop = await this.prisma.workshop.create({
      data: {
        ownerId,
        title: '',
        description: '',
        phone: '',
        addressLine: '',
        city: '',
        status: WorkshopStatus.DRAFT,
      },
      include: this.detailInclude(true, ownerId),
    });

    await this.invalidatePublicCache();
    return this.serializeDetails(workshop, getRequestOrigin(request));
  }

  async create(ownerId: string, dto: CreateWorkshopDto) {
    const nextStatus = this.resolveStatusAfterSave({
      role: UserRole.MASTER,
      currentStatus: WorkshopStatus.DRAFT,
      blockers: this.getModerationBlockers({
        title: dto.title,
        description: dto.description,
        phone: dto.phone,
        addressLine: dto.addressLine,
        city: dto.city,
        categories: dto.categoryIds,
        services: dto.services.map((service) => ({ name: service.name })),
      }),
    });

    const workshop = await this.prisma.workshop.create({
      data: {
        ownerId,
        title: dto.title,
        description: dto.description,
        phone: dto.phone,
        telegram: dto.telegram,
        addressLine: dto.addressLine,
        city: dto.city,
        openingHours: dto.openingHours,
        latitude: dto.latitude,
        longitude: dto.longitude,
        status: nextStatus,
        rejectionReason: nextStatus === WorkshopStatus.PENDING ? null : undefined,
        categories: {
          create: dto.categoryIds.map((categoryId) => ({
            categoryId,
          })),
        },
        services: {
          create: dto.services.map((service) => ({
            categoryId: service.categoryId,
            name: service.name,
            description: service.description,
            priceFrom: service.priceFrom,
            priceTo: service.priceTo,
          })),
        },
      },
      include: this.detailInclude(true, ownerId),
    });

    await this.invalidatePublicCache();
    return this.serializeDetails(workshop);
  }

  async update(
    id: string,
    user: { sub: string; role: UserRole },
    dto: UpdateWorkshopDto,
  ) {
    const workshop = await this.prisma.workshop.findUnique({
      where: { id },
    });

    if (!workshop) {
      throw new NotFoundException('Workshop not found');
    }

    this.assertOwnerOrAdmin(workshop.ownerId, user);

    const nextStatus =
      user.role === UserRole.ADMIN ? workshop.status : workshop.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const baseWorkshop = await tx.workshop.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          phone: dto.phone,
          telegram: dto.telegram,
          addressLine: dto.addressLine,
          city: dto.city,
          openingHours: dto.openingHours,
          latitude: dto.latitude,
          longitude: dto.longitude,
          status: nextStatus,
        },
      });

      if (dto.categoryIds) {
        await tx.workshopCategory.deleteMany({ where: { workshopId: id } });
        await tx.workshopCategory.createMany({
          data: dto.categoryIds.map((categoryId) => ({
            workshopId: id,
            categoryId,
          })),
        });
      }

      if (dto.services) {
        await tx.workshopService.deleteMany({ where: { workshopId: id } });

        if (dto.services.length > 0) {
          await tx.workshopService.createMany({
            data: dto.services.map((service) => ({
              workshopId: id,
              categoryId: service.categoryId,
              name: service.name,
              description: service.description,
              priceFrom: service.priceFrom,
              priceTo: service.priceTo,
            })),
          });
        }
      }

      const hydratedWorkshop = await tx.workshop.findUnique({
        where: { id },
        include: {
          categories: true,
          services: true,
        },
      });

      if (!hydratedWorkshop) {
        throw new NotFoundException('Workshop not found');
      }

      const blockers = this.getModerationBlockers(hydratedWorkshop);
      const resolvedStatus = this.resolveStatusAfterSave({
        role: user.role,
        currentStatus: workshop.status,
        blockers,
      });

      const rejectionReason =
        resolvedStatus === WorkshopStatus.PENDING
          ? null
          : resolvedStatus === WorkshopStatus.REJECTED
            ? workshop.rejectionReason
            : null;

      return tx.workshop.update({
        where: { id },
        data: {
          status: resolvedStatus,
          rejectionReason,
        },
      });
    });

    await this.invalidatePublicCache();
    return this.getDetails(updated.id, user);
  }

  async submitForModeration(id: string, user: { sub: string; role: UserRole }) {
    const workshop = await this.prisma.workshop.findUnique({
      where: { id },
      include: {
        categories: true,
        services: true,
      },
    });

    if (!workshop) {
      throw new NotFoundException('Workshop not found');
    }

    if (workshop.status === WorkshopStatus.BLOCKED) {
      throw new ForbiddenException('Blocked workshop cannot be submitted');
    }

    this.assertOwnerOrAdmin(workshop.ownerId, user);

    const blockers = this.getModerationBlockers(workshop);
    if (blockers.length > 0) {
      throw new BadRequestException(blockers);
    }

    const updated = await this.prisma.workshop.update({
      where: { id },
      data: {
        status: WorkshopStatus.PENDING,
        rejectionReason: null,
      },
    });

    await this.invalidatePublicCache();
    return updated;
  }

  async moderate(id: string, dto: ModerateWorkshopDto, actorId?: string) {
    const workshop = await this.prisma.workshop.findUnique({ where: { id } });

    if (!workshop) {
      throw new NotFoundException('Workshop not found');
    }

    const nextStatus = WorkshopStatus[dto.status as keyof typeof WorkshopStatus];
    const action =
      dto.status === WorkshopStatus.APPROVED
        ? ModerationAction.APPROVED
        : dto.status === WorkshopStatus.REJECTED
          ? ModerationAction.REJECTED
          : dto.status === WorkshopStatus.BLOCKED
            ? ModerationAction.BLOCKED
            : ModerationAction.UPDATED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextWorkshop = await tx.workshop.update({
        where: { id },
        data: {
          status: nextStatus,
          rejectionReason: dto.rejectionReason ?? null,
        },
      });

      if (dto.status === WorkshopStatus.APPROVED && dto.approvePendingPhotos) {
        await tx.workshopPhoto.updateMany({
          where: {
            workshopId: id,
            status: PhotoStatus.PENDING,
          },
          data: {
            status: PhotoStatus.APPROVED,
          },
        });
      }

      await tx.moderationLog.create({
        data: {
          actorId,
          entityType: ModerationEntityType.WORKSHOP,
          entityId: id,
          action,
          fromStatus: workshop.status,
          toStatus: nextStatus,
          note: dto.rejectionReason?.trim() || null,
          metadata: {
            approvePendingPhotos: Boolean(dto.approvePendingPhotos),
          },
        },
      });

      return nextWorkshop;
    });

    await this.invalidatePublicCache();
    return updated;
  }

  async remove(id: string, user: { sub: string; role: UserRole }) {
    const workshop = await this.prisma.workshop.findUnique({
      where: { id },
      include: {
        photos: {
          select: {
            key: true,
          },
        },
      },
    });

    if (!workshop) {
      throw new NotFoundException('Workshop not found');
    }

    this.assertOwnerOrAdmin(workshop.ownerId, user);

    const photoKeys = workshop.photos.map((photo) => photo.key);

    if (photoKeys.length > 0) {
      await this.uploadsService.deleteFiles(photoKeys);
    }

    await this.prisma.workshop.delete({
      where: { id },
    });

    await this.invalidatePublicCache();

    return {
      id,
      deleted: true,
    };
  }

  async listPending() {
    const workshops = await this.prisma.workshop.findMany({
      where: {
        status: {
          in: [WorkshopStatus.PENDING, WorkshopStatus.REJECTED],
        },
      },
      orderBy: { updatedAt: 'desc' },
      include: this.detailInclude(true),
    });

    return workshops.map((workshop) => this.serializeDetails(workshop));
  }

  async listAllAdmin() {
    const workshops = await this.prisma.workshop.findMany({
      orderBy: { updatedAt: 'desc' },
      include: this.detailInclude(true),
    });

    return workshops.map((workshop) => this.serializeDetails(workshop));
  }

  private summaryInclude(userId?: string) {
    return {
      categories: {
        include: {
          category: true,
        },
      },
      owner: {
        select: {
          isVerifiedMaster: true,
        },
      },
      photos: {
        where: {
          status: PhotoStatus.APPROVED,
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      },
      favorites: userId
        ? {
            where: { userId },
            select: { id: true },
            take: 1,
          }
        : false,
    } satisfies Prisma.WorkshopInclude;
  }

  private detailInclude(includeAllPhotos: boolean, userId?: string) {
    return {
      owner: true,
      categories: {
        include: {
          category: true,
        },
      },
      services: true,
      photos: {
        where: includeAllPhotos
          ? undefined
          : {
              status: PhotoStatus.APPROVED,
            },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      },
      reviews: {
        where:
          includeAllPhotos && userId
            ? {
                OR: [{ status: ReviewStatus.PUBLISHED }, { authorId: userId }],
              }
            : { status: ReviewStatus.PUBLISHED },
        orderBy: { createdAt: 'desc' },
        include: {
          author: true,
        },
      },
    } satisfies Prisma.WorkshopInclude;
  }

  private serializeSummary(workshop: any, origin?: string) {
    return {
      id: workshop.id,
      ownerId: workshop.ownerId,
      title: workshop.title,
      description: workshop.description,
      phone: workshop.phone,
      telegram: workshop.telegram,
      addressLine: workshop.addressLine,
      city: workshop.city,
      status: workshop.status,
      rejectionReason: workshop.rejectionReason,
      latitude: workshop.latitude != null ? Number(workshop.latitude) : null,
      longitude: workshop.longitude != null ? Number(workshop.longitude) : null,
      averageRating: Number(workshop.averageRating ?? 0),
      reviewsCount: workshop.reviewsCount,
      favoritesCount: workshop.favoritesCount,
      isFavorite:
        typeof workshop.isFavorite === 'boolean'
          ? workshop.isFavorite
          : Array.isArray(workshop.favorites)
            ? workshop.favorites.length > 0
            : false,
      isVerifiedMaster: Boolean(workshop.owner?.isVerifiedMaster),
      createdAt: workshop.createdAt.toISOString(),
      categories: workshop.categories.map(({ category }: any) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
      })),
      photos: workshop.photos.map((photo: any) => ({
        id: photo.id,
        url: buildUploadsProxyUrl(photo.key, origin),
        key: photo.key,
        isPrimary: photo.isPrimary,
        status: photo.status,
      })),
    };
  }

  private serializeDetails(workshop: any, origin?: string) {
    return {
      ...this.serializeSummary(workshop, origin),
      openingHours: workshop.openingHours,
      services: workshop.services.map((service: any) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        priceFrom: service.priceFrom ? Number(service.priceFrom) : null,
        priceTo: service.priceTo ? Number(service.priceTo) : null,
      })),
      owner: {
        id: workshop.owner.id,
        fullName: workshop.owner.fullName,
        phone: workshop.owner.phone,
        email: workshop.owner.email,
        role: workshop.owner.role,
        isBlocked: workshop.owner.isBlocked,
        isVerifiedMaster: workshop.owner.isVerifiedMaster,
        createdAt: workshop.owner.createdAt.toISOString(),
      },
      reviews: (workshop.reviews ?? []).map((review: any) => ({
        id: review.id,
        authorId: review.authorId,
        workshopId: review.workshopId,
        rating: review.rating,
        comment: review.comment,
        status: review.status,
        createdAt: review.createdAt.toISOString(),
        author: {
          id: review.author.id,
          fullName: review.author.fullName,
        },
      })),
    };
  }

  private assertOwnerOrAdmin(ownerId: string, user: { sub: string; role: UserRole }) {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    if (user.sub !== ownerId) {
      throw new ForbiddenException('You do not have access to this workshop');
    }
  }

  private getModerationBlockers(workshop: {
    title: string;
    description: string;
    phone: string;
    addressLine: string;
    city: string;
    categories: Array<unknown>;
    services: Array<{ name: string }>;
  }) {
    const blockers: string[] = [];

    if (workshop.title.trim().length < 3) {
      blockers.push('Добавьте название объявления.');
    }

    if (workshop.description.trim().length < 10) {
      blockers.push('Добавьте описание минимум на 10 символов.');
    }

    if (workshop.phone.trim().length < 6) {
      blockers.push('Укажите контактный телефон.');
    }

    if (workshop.addressLine.trim().length < 4) {
      blockers.push('Укажите адрес мастерской.');
    }

    if (workshop.city.trim().length < 2) {
      blockers.push('Укажите город.');
    }

    if (workshop.categories.length === 0) {
      blockers.push('Выберите хотя бы одну категорию услуг.');
    }

    if (workshop.services.length === 0) {
      blockers.push('Добавьте хотя бы одну услугу.');
    } else if (workshop.services.some((service) => service.name.trim().length < 2)) {
      blockers.push('Заполните названия всех услуг.');
    }

    return blockers;
  }

  private resolveStatusAfterSave({
    role,
    currentStatus,
    blockers,
  }: {
    role: UserRole;
    currentStatus: WorkshopStatus;
    blockers: string[];
  }) {
    if (role === UserRole.ADMIN) {
      return currentStatus;
    }

    if (currentStatus === WorkshopStatus.BLOCKED) {
      return WorkshopStatus.BLOCKED;
    }

    if (blockers.length === 0) {
      return WorkshopStatus.PENDING;
    }

    if (currentStatus === WorkshopStatus.REJECTED) {
      return WorkshopStatus.REJECTED;
    }

    if (currentStatus === WorkshopStatus.PENDING) {
      return WorkshopStatus.PENDING;
    }

    return WorkshopStatus.DRAFT;
  }

  private async invalidatePublicCache() {
    await this.redisService.deleteByPrefix(WORKSHOP_PUBLIC_CACHE_PREFIX);
  }
}
