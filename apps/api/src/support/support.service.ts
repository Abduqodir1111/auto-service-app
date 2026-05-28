import { Injectable, NotFoundException } from '@nestjs/common';
import {
  SupportTicketStatus as DbSupportTicketStatus,
  SupportTicketType as DbSupportTicketType,
} from '@prisma/client';
import { SupportTicketStatus, SupportTicketType } from '@stomvp/shared';
import { PrismaService } from '../database/prisma.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSupportTicketDto) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId,
        type: DbSupportTicketType[dto.type as keyof typeof DbSupportTicketType],
        message: dto.message.trim(),
        contactPhone: dto.contactPhone?.trim() || null,
      },
      include: {
        user: true,
      },
    });

    return this.serialize(ticket);
  }

  async listAll() {
    const tickets = await this.prisma.supportTicket.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        user: true,
      },
    });

    return tickets.map((ticket) => this.serialize(ticket));
  }

  async updateStatus(id: string, dto: UpdateSupportTicketStatusDto) {
    const existing = await this.prisma.supportTicket.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Support ticket not found');
    }

    const ticket = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: DbSupportTicketStatus[dto.status as keyof typeof DbSupportTicketStatus],
        resolution: dto.resolution?.trim() || null,
      },
      include: {
        user: true,
      },
    });

    return this.serialize(ticket);
  }

  private serialize(ticket: {
    id: string;
    userId: string | null;
    type: DbSupportTicketType;
    message: string;
    contactPhone: string | null;
    status: DbSupportTicketStatus;
    resolution: string | null;
    createdAt: Date;
    updatedAt: Date;
    user?: {
      id: string;
      fullName: string;
      phone: string;
      role: string;
    } | null;
  }) {
    return {
      id: ticket.id,
      userId: ticket.userId,
      type: ticket.type as SupportTicketType,
      message: ticket.message,
      contactPhone: ticket.contactPhone,
      status: ticket.status as SupportTicketStatus,
      resolution: ticket.resolution,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      user: ticket.user
        ? {
            id: ticket.user.id,
            fullName: ticket.user.fullName,
            phone: ticket.user.phone,
            role: ticket.user.role,
          }
        : null,
    };
  }
}
