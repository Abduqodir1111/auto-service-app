import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
}
