import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportStatus } from '@stomvp/shared';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateReportStatusDto {
  @ApiProperty({ enum: ReportStatus, enumName: 'ReportStatus' })
  @IsEnum(ReportStatus)
  status!: ReportStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolution?: string;
}
