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
import { PhotoStatus } from '@prisma/client';
import { PhotoStatus as ApiPhotoStatus, UserRole } from '@stomvp/shared';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../database/prisma.service';
import { S3_CLIENT } from './uploads.constants';
import { buildUploadsProxyUrl } from './uploads.utils';

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly bucket: string;

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET');
  }

  async onModuleInit() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
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

    return {
      ...photo,
      url: this.getPublicUrl(photo.key, origin),
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

  async moderate(id: string, status: ApiPhotoStatus, origin?: string) {
    const photo = await this.prisma.workshopPhoto.findUnique({ where: { id } });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    const updated = await this.prisma.workshopPhoto.update({
      where: { id },
      data: { status: PhotoStatus[status as keyof typeof PhotoStatus] },
    });

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
}
