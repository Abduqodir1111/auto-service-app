import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus } from '@stomvp/shared';
import { IsEnum } from 'class-validator';

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: ApplicationStatus, enumName: 'ApplicationStatus' })
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;
}
