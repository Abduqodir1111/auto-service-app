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
}
