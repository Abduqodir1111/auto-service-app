import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkshopStatus } from '@stomvp/shared';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class ModerateWorkshopDto {
  @ApiProperty({ enum: WorkshopStatus, enumName: 'WorkshopStatus' })
  @IsEnum(WorkshopStatus)
  status!: WorkshopStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  approvePendingPhotos?: boolean;
}
