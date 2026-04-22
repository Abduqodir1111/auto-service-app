import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseFilePipeBuilder,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@stomvp/shared';
import { Request, Response } from 'express';
import multer from 'multer';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UploadsService } from './uploads.service';
import { getRequestOrigin } from './uploads.utils';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('file')
  async file(@Query('key') key: string, @Res() response: Response) {
    if (!key) {
      throw new BadRequestException('Photo key is required');
    }

    let file;

    try {
      file = await this.uploadsService.getFile(key);
    } catch (error) {
      const statusCode =
        typeof error === 'object' &&
        error !== null &&
        '$metadata' in error &&
        typeof (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ===
          'number'
          ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
          : null;
      const errorName =
        typeof error === 'object' && error !== null && 'name' in error
          ? String((error as { name?: string }).name)
          : null;

      if (statusCode === 404 || errorName === 'NoSuchKey') {
        throw new NotFoundException('Photo not found');
      }

      throw error;
    }

    if (!file.Body) {
      throw new BadRequestException('Photo body is empty');
    }

    if (file.ContentType) {
      response.setHeader('Content-Type', file.ContentType);
    }

    if (file.ContentLength) {
      response.setHeader('Content-Length', String(file.ContentLength));
    }

    response.setHeader('Cache-Control', 'public, max-age=86400');

    const bytes = await file.Body.transformToByteArray();
    response.end(Buffer.from(bytes));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @Post('workshops/:workshopId/photos')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadWorkshopPhoto(
    @Param('workshopId') workshopId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png|webp|heic|heif)$/i })
        .build({
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
    @Req() request: Request,
  ) {
    return this.uploadsService.uploadWorkshopPhoto(
      workshopId,
      file,
      user,
      getRequestOrigin(request),
    );
  }
}
