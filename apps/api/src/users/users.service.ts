import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UploadsService } from '../uploads/uploads.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const WORKSHOP_PUBLIC_CACHE_PREFIX = 'workshops:public:';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly redisService: RedisService,
  ) {}

  async getByIdOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  serialize(user: User) {
    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      isBlocked: user.isBlocked,
      isVerifiedMaster: user.isVerifiedMaster,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.email) {
      const existingByEmail = await this.prisma.user.findFirst({
        where: {
          email: dto.email,
          NOT: {
            id: userId,
          },
        },
      });

      if (existingByEmail) {
        throw new ConflictException('Email is already used by another account');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto satisfies Prisma.UserUpdateInput,
    });

    return this.serialize(user);
  }

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workshops: {
          include: {
            photos: {
              select: { key: true },
            },
          },
        },
        uploadedPhotos: {
          select: {
            key: true,
            workshopId: true,
          },
        },
        favorites: {
          select: {
            workshopId: true,
          },
        },
        reviews: {
          select: {
            workshopId: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const ownedWorkshopIds = new Set(user.workshops.map((workshop) => workshop.id));
    const photoKeys = new Set<string>();

    for (const workshop of user.workshops) {
      for (const photo of workshop.photos) {
        photoKeys.add(photo.key);
      }
    }

    for (const photo of user.uploadedPhotos) {
      if (!ownedWorkshopIds.has(photo.workshopId)) {
        photoKeys.add(photo.key);
      }
    }

    const favoriteWorkshopIds = user.favorites.map((favorite) => favorite.workshopId);
    const reviewedWorkshopIds = user.reviews.map((review) => review.workshopId);
    const affectedWorkshopIds = [...new Set([...favoriteWorkshopIds, ...reviewedWorkshopIds])].filter(
      (workshopId) => !ownedWorkshopIds.has(workshopId),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.favorite.deleteMany({ where: { userId } });
      await tx.application.deleteMany({ where: { customerId: userId } });
      await tx.review.deleteMany({ where: { authorId: userId } });
      await tx.report.deleteMany({ where: { reporterId: userId } });
      await tx.workshopPhoto.deleteMany({
        where: {
          uploaderId: userId,
          workshopId: {
            notIn: [...ownedWorkshopIds],
          },
        },
      });
      await tx.workshop.deleteMany({ where: { ownerId: userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    await Promise.all(
      affectedWorkshopIds.map(async (workshopId) => {
        const [favoriteCount, reviewAggregate] = await Promise.all([
          this.prisma.favorite.count({ where: { workshopId } }),
          this.prisma.review.aggregate({
            where: {
              workshopId,
              status: ReviewStatus.PUBLISHED,
            },
            _avg: {
              rating: true,
            },
            _count: {
              _all: true,
            },
          }),
        ]);

        await this.prisma.workshop.update({
          where: { id: workshopId },
          data: {
            favoritesCount: favoriteCount,
            averageRating: reviewAggregate._avg.rating ?? 0,
            reviewsCount: reviewAggregate._count._all,
          },
        });
      }),
    );

    try {
      await this.uploadsService.deleteFiles([...photoKeys]);
    } catch (error) {
      console.error('Failed to delete account files from storage', error);
    }

    await this.redisService.deleteByPrefix(WORKSHOP_PUBLIC_CACHE_PREFIX);

    return {
      deleted: true,
    };
  }
}
