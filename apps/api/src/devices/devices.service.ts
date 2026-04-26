import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent register-or-update. If the same Expo push token exists
   * (e.g. user re-installed the app and got the same token), we just point
   * it at the new userId — old user no longer owns it.
   */
  async register(userId: string, dto: RegisterDeviceDto) {
    return this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      update: {
        userId,
        platform: dto.platform,
      },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
      },
    });
  }

  async unregister(userId: string, token: string): Promise<{ success: boolean }> {
    await this.prisma.deviceToken.deleteMany({
      where: { token, userId },
    });
    return { success: true };
  }

  /** Returns every Expo push token currently associated with the user. */
  async getTokensForUser(userId: string): Promise<string[]> {
    const rows = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });
    return rows.map((row) => row.token);
  }

  /**
   * Called by PushNotificationsService when Expo reports a token is
   * permanently invalid (DeviceNotRegistered, InvalidCredentials, etc.).
   * Drops the rows quietly.
   */
  async pruneTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.prisma.deviceToken.deleteMany({
      where: { token: { in: tokens } },
    });
  }
}
