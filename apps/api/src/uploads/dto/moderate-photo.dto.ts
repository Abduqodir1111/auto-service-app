import { ApiProperty } from '@nestjs/swagger';
import { PhotoStatus } from '@stomvp/shared';
import { IsEnum } from 'class-validator';

export class ModeratePhotoDto {
  @ApiProperty({ enum: PhotoStatus, enumName: 'PhotoStatus' })
  @IsEnum(PhotoStatus)
  status!: PhotoStatus;
}
