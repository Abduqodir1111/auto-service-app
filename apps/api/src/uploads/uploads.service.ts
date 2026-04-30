import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ModerationAction, ModerationEntityType, PhotoStatus } from '@prisma/client';
import { PhotoStatus as ApiPhotoStatus, UserRole } from '@stomvp/shared';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { S3_CLIENT } from './uploads.constants';
import { buildUploadsProxyUrl } from './uploads.utils';

const WORKSHOP_PUBLIC_CACHE_PREFIX = 'workshops:public:';

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly bucket: string;

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET');
  }

  async onModuleInit() {
    // Tests don't run a real S3/MinIO endpoint and never exercise upload
    // paths; calling HeadBucket here would just hang the boot of every e2e
    // suite. Production / dev still get the bucket created on demand.
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      return;
    }
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  /**
   * Liveness probe used by HealthService — pings the configured S3 bucket.
   * Throws if the bucket is unreachable or auth is broken.
   */
  async healthCheck(): Promise<void> {
    await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  async uploadWorkshopPhoto(
    workshopId: string,
    file: Express.Multer.File,
    user: { sub: string; role: UserRole },
    origin?: string,
  ) {
    const workshop = await this.prisma.workshop.findUnique({
      where: { id: workshopId },
      include: { photos: true },
    });

    if (!workshop) {
      throw new NotFoundException('Workshop not found');
    }

    const canUpload = user.role === UserRole.ADMIN || workshop.ownerId === user.sub;

    if (!canUpload) {
      throw new ForbiddenException('You cannot upload photos to this workshop');
    }

    const key = `workshops/${workshopId}/${randomUUID()}${extname(file.originalname) || '.jpg'}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const photo = await this.prisma.workshopPhoto.create({
      data: {
        workshopId,
        uploaderId: user.sub,
        key,
        url: this.buildStorageUrl(key),
        status: user.role === UserRole.ADMIN ? PhotoStatus.APPROVED : PhotoStatus.PENDING,
        isPrimary: workshop.photos.length === 0,
      },
    });

    await this.invalidatePublicCache();

    return {
      ...photo,
      url: this.getPublicUrl(photo.key, origin),
    };
  }

  async setPrimaryPhoto(
    id: string,
    user: { sub: string; role: UserRole },
    origin?: string,
  ) {
    const photo = await this.prisma.workshopPhoto.findUnique({
      where: { id },
      include: { workshop: true },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    this.assertCanManagePhoto(photo.workshop.ownerId, user);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.workshopPhoto.updateMany({
        where: { workshopId: photo.workshopId },
        data: { isPrimary: false },
      });

      return tx.workshopPhoto.update({
        where: { id },
        data: { isPrimary: true },
      });
    });

    await this.invalidatePublicCache();

    return {
      ...updated,
      url: this.getPublicUrl(updated.key, origin),
    };
  }

  async deletePhoto(id: string, user: { sub: string; role: UserRole }) {
    const photo = await this.prisma.workshopPhoto.findUnique({
      where: { id },
      include: { workshop: true },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    this.assertCanManagePhoto(photo.workshop.ownerId, user);

    const replacement = await this.prisma.$transaction(async (tx) => {
      await tx.workshopPhoto.delete({ where: { id } });

      if (!photo.isPrimary) {
        return null;
      }

      const nextPhoto =
        (await tx.workshopPhoto.findFirst({
          where: {
            workshopId: photo.workshopId,
            status: { not: PhotoStatus.REJECTED },
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        })) ??
        (await tx.workshopPhoto.findFirst({
          where: { workshopId: photo.workshopId },
          orderBy: { createdAt: 'desc' },
        }));

      if (!nextPhoto) {
        return null;
      }

      return tx.workshopPhoto.update({
        where: { id: nextPhoto.id },
        data: { isPrimary: true },
      });
    });

    await this.deleteFiles([photo.key]);
    await this.invalidatePublicCache();

    return {
      id,
      deleted: true,
      primaryPhotoId: replacement?.id ?? null,
    };
  }

  async listPending(origin?: string) {
    const photos = await this.prisma.workshopPhoto.findMany({
      where: { status: PhotoStatus.PENDING },
      include: {
        workshop: true,
        uploader: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return photos.map((photo) => ({
      ...photo,
      url: this.getPublicUrl(photo.key, origin),
    }));
  }

  async moderate(id: string, status: ApiPhotoStatus, origin?: string, actorId?: string) {
    const photo = await this.prisma.workshopPhoto.findUnique({ where: { id } });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    const nextStatus = PhotoStatus[status as keyof typeof PhotoStatus];
    const updated = await this.prisma.$transaction(async (tx) => {
      const nextPhoto = await tx.workshopPhoto.update({
        where: { id },
        data: { status: nextStatus },
      });

      await tx.moderationLog.create({
        data: {
          actorId,
          entityType: ModerationEntityType.PHOTO,
          entityId: id,
          action:
            status === ApiPhotoStatus.APPROVED
              ? ModerationAction.APPROVED
              : ModerationAction.REJECTED,
          fromStatus: photo.status,
          toStatus: nextStatus,
          metadata: {
            workshopId: photo.workshopId,
          },
        },
      });

      return nextPhoto;
    });

    await this.invalidatePublicCache();

    return {
      ...updated,
      url: this.getPublicUrl(updated.key, origin),
    };
  }

  async moderatePendingForWorkshop(workshopId: string, status: ApiPhotoStatus) {
    await this.prisma.workshopPhoto.updateMany({
      where: {
        workshopId,
        status: PhotoStatus.PENDING,
      },
      data: {
        status: PhotoStatus[status as keyof typeof PhotoStatus],
      },
    });
  }

  async getFile(key: string) {
    return this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async deleteFiles(keys: string[]) {
    if (keys.length === 0) {
      return;
    }

    await this.s3.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
          Quiet: true,
        },
      }),
    );
  }

  getPublicUrl(key: string, origin?: string) {
    return buildUploadsProxyUrl(key, origin);
  }

  private buildStorageUrl(key: string) {
    const publicUrl = this.configService.get<string>('S3_PUBLIC_URL');

    if (publicUrl) {
      return `${publicUrl.replace(/\/$/, '')}/${key}`;
    }

    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    return `${endpoint?.replace(/\/$/, '')}/${this.bucket}/${key}`;
  }

  private assertCanManagePhoto(ownerId: string, user: { sub: string; role: UserRole }) {
    if (user.role === UserRole.ADMIN || ownerId === user.sub) {
      return;
    }

    throw new ForbiddenException('You cannot manage this photo');
  }

  private async invalidatePublicCache() {
    await this.redisService.deleteByPrefix(WORKSHOP_PUBLIC_CACHE_PREFIX);
  }
}
