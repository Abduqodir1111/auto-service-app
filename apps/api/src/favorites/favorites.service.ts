import { Injectable, NotFoundException } from '@nestjs/common';
import { PhotoStatus, WorkshopStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { buildUploadsProxyUrl } from '../uploads/uploads.utils';

const WORKSHOP_PUBLIC_CACHE_PREFIX = 'workshops:public:';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async list(userId: string, origin?: string) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        workshop: {
          include: {
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
              where: { status: PhotoStatus.APPROVED },
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
            },
          },
        },
      },
    });

    return favorites.map(({ workshop }) => ({
      id: workshop.id,
      ownerId: workshop.ownerId,
      title: workshop.title,
      description: workshop.description,
      phone: workshop.phone,
      telegram: workshop.telegram,
      addressLine: workshop.addressLine,
      city: workshop.city,
      status: workshop.status,
      latitude: workshop.latitude != null ? Number(workshop.latitude) : null,
      longitude: workshop.longitude != null ? Number(workshop.longitude) : null,
      averageRating: Number(workshop.averageRating ?? 0),
      reviewsCount: workshop.reviewsCount,
      favoritesCount: workshop.favoritesCount,
      isFavorite: true,
      isVerifiedMaster: workshop.owner.isVerifiedMaster,
      createdAt: workshop.createdAt.toISOString(),
      categories: workshop.categories.map(({ category }) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
      })),
      photos: workshop.photos.map((photo) => ({
        id: photo.id,
        key: photo.key,
        url: buildUploadsProxyUrl(photo.key, origin),
        isPrimary: photo.isPrimary,
        status: photo.status,
      })),
    }));
  }

  async add(userId: string, workshopId: string) {
    const workshop = await this.prisma.workshop.findUnique({
      where: { id: workshopId },
    });

    if (!workshop || workshop.status !== WorkshopStatus.APPROVED) {
      throw new NotFoundException('Workshop not found');
    }

    const existing = await this.prisma.favorite.findUnique({
      where: {
        userId_workshopId: {
          userId,
          workshopId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    const favorite = await this.prisma.$transaction(async (tx) => {
      const created = await tx.favorite.create({
        data: {
          userId,
          workshopId,
        },
      });

      await tx.workshop.update({
        where: { id: workshopId },
        data: {
          favoritesCount: {
            increment: 1,
          },
        },
      });

      return created;
    });

    await this.redisService.deleteByPrefix(WORKSHOP_PUBLIC_CACHE_PREFIX);
    return favorite;
  }

  async remove(userId: string, workshopId: string) {
    const deleted = await this.prisma.favorite.deleteMany({
      where: {
        userId,
        workshopId,
      },
    });

    if (deleted.count > 0) {
      await this.prisma.workshop.update({
        where: { id: workshopId },
        data: {
          favoritesCount: {
            decrement: 1,
          },
        },
      });

      await this.redisService.deleteByPrefix(WORKSHOP_PUBLIC_CACHE_PREFIX);
    }

    return { removed: deleted.count > 0 };
  }
}
