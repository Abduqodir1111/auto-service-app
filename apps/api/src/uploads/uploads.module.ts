import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { UploadsController } from './uploads.controller';
import { S3_CLIENT } from './uploads.constants';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new S3Client({
          region: configService.getOrThrow<string>('S3_REGION'),
          endpoint: configService.get<string>('S3_ENDPOINT'),
          forcePathStyle: configService.get<boolean>('S3_FORCE_PATH_STYLE', false),
          credentials: {
            accessKeyId: configService.getOrThrow<string>('S3_ACCESS_KEY_ID'),
            secretAccessKey: configService.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
          },
        }),
    },
    UploadsService,
  ],
  exports: [UploadsService],
})
export class UploadsModule {}
