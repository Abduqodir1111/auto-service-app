import { Injectable, NotFoundException } from '@nestjs/common';
import { PhotoStatus, ReviewStatus, UserRole } from '@prisma/client';
import { PhotoStatus as ApiPhotoStatus } from '@stomvp/shared';
import { PrismaService } from '../database/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
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
  ) {}

  async analytics() {
    const [
      totalUsers,
      totalMasters,
      totalWorkshops,
      pendingWorkshops,
      pendingReviews,
      pendingPhotos,
      totalApplications,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.MASTER } }),
      this.prisma.workshop.count(),
      this.prisma.workshop.count({ where: { status: 'PENDING' } }),
      this.prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
      this.prisma.workshopPhoto.count({ where: { status: PhotoStatus.PENDING } }),
      this.prisma.application.count(),
    ]);

    return {
      totalUsers,
      totalMasters,
      totalWorkshops,
      pendingWorkshops,
      pendingReviews,
      pendingPhotos,
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
      createdAt: user.createdAt.toISOString(),
    }));
  }

  async blockUser(id: string, isBlocked: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id },
      data: { isBlocked },
    });
  }

  async listWorkshops() {
    return this.workshopsService.listAllAdmin();
  }

  async moderateWorkshop(id: string, dto: ModerateWorkshopDto) {
    return this.workshopsService.moderate(id, dto);
  }

  async listReviewsPending() {
    return this.reviewsService.listPending();
  }

  async moderateReview(id: string, dto: ModerateReviewDto) {
    return this.reviewsService.moderate(id, dto);
  }

  async listPhotosPending(origin?: string) {
    return this.uploadsService.listPending(origin);
  }

  async moderatePhoto(id: string, status: ApiPhotoStatus, origin?: string) {
    return this.uploadsService.moderate(id, status, origin);
  }

  async listApplications() {
    return this.applicationsService.listAll();
  }
}
