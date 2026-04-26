import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, WorkshopStatus } from '@prisma/client';
import { UserRole } from '@stomvp/shared';
import { PrismaService } from '../database/prisma.service';
import { PushNotificationsService } from '../devices/push-notifications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

const APPLICATION_STATUS_PUSH: Record<
  ApplicationStatus,
  { title: string; verb: string } | null
> = {
  [ApplicationStatus.NEW]: null, // initial state, no push needed
  [ApplicationStatus.IN_PROGRESS]: { title: '🔧 Заявка принята', verb: 'принял в работу' },
  [ApplicationStatus.COMPLETED]: { title: '✅ Заявка выполнена', verb: 'отметил как выполненную' },
  [ApplicationStatus.CANCELLED]: { title: '🚫 Заявка отменена', verb: 'отменил' },
};

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService,
  ) {}

  async create(userId: string, role: UserRole, dto: CreateApplicationDto) {
    if (role === UserRole.ADMIN) {
      throw new ForbiddenException('Admins cannot create applications');
    }

    const workshop = await this.prisma.workshop.findUnique({
      where: { id: dto.workshopId },
    });

    if (!workshop || workshop.status !== WorkshopStatus.APPROVED) {
      throw new NotFoundException('Workshop not found');
    }

    const application = await this.prisma.application.create({
      data: {
        customerId: userId,
        workshopId: dto.workshopId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        carModel: dto.carModel,
        issueDescription: dto.issueDescription,
        preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : undefined,
      },
    });

    // Notify the workshop owner. Push errors are swallowed by the helper —
    // we never want a flaky push to fail the create-application call.
    void this.push.sendToUser(workshop.ownerId, {
      title: '🔔 Новая заявка',
      body: `${dto.customerName}: ${dto.issueDescription}`.slice(0, 200),
      data: {
        type: 'application.created',
        applicationId: application.id,
        workshopId: workshop.id,
      },
    });

    return application;
  }

  async listMine(
    user: { sub: string; role: UserRole },
    query: ListApplicationsQueryDto,
  ) {
    const scope =
      query.scope ?? (user.role === UserRole.MASTER ? 'received' : 'sent');

    if (scope === 'sent') {
      const items = await this.prisma.application.findMany({
        where: {
          customerId: user.sub,
        },
        include: {
          workshop: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return items.map((item) => this.serialize(item));
    }

    if (user.role === UserRole.CLIENT) {
      throw new ForbiddenException('Clients cannot view received applications');
    }

    const items = await this.prisma.application.findMany({
      where: {
        workshop: {
          ownerId: user.sub,
        },
      },
      include: {
        workshop: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((item) => this.serialize(item));
  }

  async updateStatus(
    id: string,
    user: { sub: string; role: UserRole },
    dto: UpdateApplicationStatusDto,
  ) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        workshop: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const canManage =
      user.role === UserRole.ADMIN || application.workshop.ownerId === user.sub;

    if (!canManage) {
      throw new ForbiddenException('You cannot update this application');
    }

    const newStatus = ApplicationStatus[dto.status as keyof typeof ApplicationStatus];
    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status: newStatus,
      },
      include: {
        workshop: true,
      },
    });

    const pushSpec = APPLICATION_STATUS_PUSH[newStatus];
    if (pushSpec && updated.customerId !== user.sub) {
      // Don't notify the actor about their own action.
      void this.push.sendToUser(updated.customerId, {
        title: pushSpec.title,
        body: `Мастер ${pushSpec.verb} вашу заявку на «${updated.workshop.title}»`,
        data: {
          type: 'application.status_changed',
          applicationId: updated.id,
          status: newStatus,
        },
      });
    }

    return this.serialize(updated);
  }

  async listAll() {
    const items = await this.prisma.application.findMany({
      include: {
        workshop: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((item) => this.serialize(item));
  }

  private serialize(item: any) {
    return {
      id: item.id,
      workshopId: item.workshopId,
      customerId: item.customerId,
      customerName: item.customerName,
      customerPhone: item.customerPhone,
      carModel: item.carModel,
      issueDescription: item.issueDescription,
      preferredDate: item.preferredDate ? item.preferredDate.toISOString() : null,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      workshop: item.workshop
        ? {
            id: item.workshop.id,
            title: item.workshop.title,
            phone: item.workshop.phone,
          }
        : null,
    };
  }
}
