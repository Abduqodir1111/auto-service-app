import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ModerationAction,
  ModerationEntityType,
  ReviewStatus,
  WorkshopStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(workshopId: string) {
    const reviews = await this.prisma.review.findMany({
      where: {
        workshopId,
        status: ReviewStatus.PUBLISHED,
      },
      include: {
        author: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((review) => ({
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
    }));
  }

  async create(userId: string, dto: CreateReviewDto) {
    const [workshop, existingReview] = await Promise.all([
      this.prisma.workshop.findUnique({ where: { id: dto.workshopId } }),
      this.prisma.review.findUnique({
        where: {
          authorId_workshopId: {
            authorId: userId,
            workshopId: dto.workshopId,
          },
        },
      }),
    ]);

    if (!workshop || workshop.status !== WorkshopStatus.APPROVED) {
      throw new NotFoundException('Workshop not found');
    }

    if (workshop.ownerId === userId) {
      throw new ForbiddenException('Owners cannot review their own workshop');
    }

    const comment = dto.comment.trim();

    if (comment.length < 6) {
      throw new BadRequestException('Комментарий должен быть не короче 6 символов.');
    }

    const review = existingReview
      ? await this.prisma.review.update({
          where: { id: existingReview.id },
          data: {
            rating: dto.rating,
            comment,
            status: ReviewStatus.PUBLISHED,
          },
        })
      : await this.prisma.review.create({
          data: {
            authorId: userId,
            workshopId: dto.workshopId,
            rating: dto.rating,
            comment,
            status: ReviewStatus.PUBLISHED,
          },
        });

    await this.refreshWorkshopRating(dto.workshopId);
    return review;
  }

  async listPending() {
    const reviews = await this.prisma.review.findMany({
      where: {
        status: ReviewStatus.PENDING,
      },
      include: {
        author: true,
        workshop: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      status: review.status,
      createdAt: review.createdAt.toISOString(),
      author: {
        id: review.author.id,
        fullName: review.author.fullName,
      },
      workshop: {
        id: review.workshop.id,
        title: review.workshop.title,
      },
    }));
  }

  async moderate(id: string, dto: ModerateReviewDto, actorId?: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const nextStatus = ReviewStatus[dto.status as keyof typeof ReviewStatus];
    const action =
      dto.status === ReviewStatus.PUBLISHED
        ? ModerationAction.APPROVED
        : dto.status === ReviewStatus.REJECTED
          ? ModerationAction.REJECTED
          : ModerationAction.UPDATED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextReview = await tx.review.update({
        where: { id },
        data: {
          status: nextStatus,
        },
      });

      await tx.moderationLog.create({
        data: {
          actorId,
          entityType: ModerationEntityType.REVIEW,
          entityId: id,
          action,
          fromStatus: review.status,
          toStatus: nextStatus,
        },
      });

      return nextReview;
    });

    await this.refreshWorkshopRating(updated.workshopId);
    return updated;
  }

  async refreshWorkshopRating(workshopId: string) {
    const aggregate = await this.prisma.review.aggregate({
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
    });

    await this.prisma.workshop.update({
      where: { id: workshopId },
      data: {
        averageRating: aggregate._avg.rating ?? 0,
        reviewsCount: aggregate._count._all,
      },
    });
  }
}
