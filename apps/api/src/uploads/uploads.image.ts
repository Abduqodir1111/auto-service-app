import { BadRequestException } from '@nestjs/common';
import sharp, { type FormatEnum } from 'sharp';

export const PHOTO_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

const PHOTO_MAX_INPUT_PIXELS = 36_000_000;
const PHOTO_MAX_DIMENSION = 1600;
const PHOTO_JPEG_QUALITY = 82;
const ALLOWED_INPUT_FORMATS = new Set<keyof FormatEnum>(['jpeg', 'png', 'webp', 'heif']);

export type SanitizedWorkshopPhoto = {
  buffer: Buffer;
  extension: '.jpg';
  mimeType: 'image/jpeg';
};

export async function sanitizeWorkshopPhoto(
  file: Express.Multer.File,
): Promise<SanitizedWorkshopPhoto> {
  if (!file.buffer?.length) {
    throw new BadRequestException('Фото пустое. Выберите другое изображение.');
  }

  if (file.buffer.length > PHOTO_UPLOAD_MAX_BYTES) {
    throw new BadRequestException('Фото слишком большое. Максимальный размер — 5 МБ.');
  }

  let metadata: sharp.Metadata;

  try {
    metadata = await sharp(file.buffer, {
      failOn: 'warning',
      limitInputPixels: PHOTO_MAX_INPUT_PIXELS,
      sequentialRead: true,
    }).metadata();
  } catch {
    throw new BadRequestException('Файл должен быть настоящим изображением JPG, PNG, WEBP или HEIC.');
  }

  if (!metadata.format || !ALLOWED_INPUT_FORMATS.has(metadata.format)) {
    throw new BadRequestException('Поддерживаются только изображения JPG, PNG, WEBP или HEIC.');
  }

  if (!metadata.width || !metadata.height) {
    throw new BadRequestException('Не удалось прочитать размер изображения.');
  }

  try {
    const { data } = await sharp(file.buffer, {
      failOn: 'warning',
      limitInputPixels: PHOTO_MAX_INPUT_PIXELS,
      sequentialRead: true,
    })
      // Applies EXIF orientation before metadata is stripped by the JPEG output.
      .rotate()
      .resize({
        width: PHOTO_MAX_DIMENSION,
        height: PHOTO_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({
        quality: PHOTO_JPEG_QUALITY,
        mozjpeg: true,
      })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      extension: '.jpg',
      mimeType: 'image/jpeg',
    };
  } catch {
    throw new BadRequestException('Не удалось обработать фото. Попробуйте другое изображение.');
  }
}
