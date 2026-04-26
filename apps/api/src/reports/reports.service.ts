import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ModerationAction,
  ModerationEntityType,
  ReportStatus as DbReportStatus,
  ReportTargetType as DbReportTargetType,
} from '@prisma/client';
import { ReportStatus, ReportTargetType } from '@stomvp/shared';
import { PrismaService } from '../database/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(reporterId: string, dto: CreateReportDto) {
    await this.assertTargetExists(dto.targetType, dto.targetId);

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: DbReportTargetType[dto.targetType as keyof typeof DbReportTargetType],
        targetId: dto.targetId,
        reason: dto.reason.trim(),
        comment: dto.comment?.trim() || null,
      },
      include: {
        reporter: true,
      },
    });

    return this.serialize(report);
  }

  async listAll() {
    const reports = await this.prisma.report.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        reporter: true,
      },
    });

    return Promise.all(
      reports.map(async (report) => ({
        ...this.serialize(report),
        target: await this.getTargetPreview(
          report.targetType as ReportTargetType,
          report.targetId,
        ),
      })),
    );
  }

  async updateStatus(id: string, dto: UpdateReportStatusDto, actorId?: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const nextStatus = DbReportStatus[dto.status as keyof typeof DbReportStatus];
    const action =
      dto.status === ReportStatus.RESOLVED
        ? ModerationAction.RESOLVED
        : dto.status === ReportStatus.REJECTED
          ? ModerationAction.REJECTED
          : ModerationAction.UPDATED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextReport = await tx.report.update({
        where: { id },
        data: {
          status: nextStatus,
          resolution: dto.resolution?.trim() || null,
        },
        include: {
          reporter: true,
        },
      });

      await tx.moderationLog.create({
        data: {
          actorId,
          entityType: ModerationEntityType.REPORT,
          entityId: id,
          action,
          fromStatus: report.status,
          toStatus: nextStatus,
          note: dto.resolution?.trim() || null,
          metadata: {
            targetType: report.targetType,
            targetId: report.targetId,
          },
        },
      });

      return nextReport;
    });

    return {
      ...this.serialize(updated),
      target: await this.getTargetPreview(updated.targetType as ReportTargetType, updated.targetId),
    };
  }

  private async assertTargetExists(targetType: ReportTargetType, targetId: string) {
    const target = await this.getTargetPreview(targetType, targetId);

    if (!target) {
      throw new NotFoundException('Report target not found');
    }
  }

  private async getTargetPreview(targetType: ReportTargetType, targetId: string) {
    if (targetType === ReportTargetType.WORKSHOP) {
      const workshop = await this.prisma.workshop.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          title: true,
          status: true,
          owner: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
        },
      });

      return workshop
        ? {
            id: workshop.id,
            title: workshop.title || 'Объявление без названия',
            type: targetType,
            status: workshop.status,
            owner: workshop.owner,
          }
        : null;
    }

    if (targetType === ReportTargetType.PHOTO) {
      const photo = await this.prisma.workshopPhoto.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          status: true,
          workshop: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      return photo
        ? {
            id: photo.id,
            title: `Фото: ${photo.workshop.title || 'объявление без названия'}`,
            type: targetType,
            status: photo.status,
            workshop: photo.workshop,
          }
        : null;
    }

    if (targetType === ReportTargetType.REVIEW) {
      const review = await this.prisma.review.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          status: true,
          comment: true,
          author: {
            select: {
              id: true,
              fullName: true,
            },
          },
          workshop: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      return review
        ? {
            id: review.id,
            title: `Отзыв к ${review.workshop.title || 'объявлению'}`,
            type: targetType,
            status: review.status,
            comment: review.comment,
            author: review.author,
            workshop: review.workshop,
          }
        : null;
    }

    throw new BadRequestException('Unsupported report target type');
  }

  private serialize(report: {
    id: string;
    reporterId: string | null;
    targetType: DbReportTargetType;
    targetId: string;
    reason: string;
    comment: string | null;
    status: DbReportStatus;
    resolution: string | null;
    createdAt: Date;
    updatedAt: Date;
    reporter?: {
      id: string;
      fullName: string;
      phone: string;
    } | null;
  }) {
    return {
      id: report.id,
      reporterId: report.reporterId,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      comment: report.comment,
      status: report.status,
      resolution: report.resolution,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      reporter: report.reporter
        ? {
            id: report.reporter.id,
            fullName: report.reporter.fullName,
            phone: report.reporter.phone,
          }
        : null,
    };
  }
}
