import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportTargetType } from '@stomvp/shared';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ enum: ReportTargetType, enumName: 'ReportTargetType' })
  @IsEnum(ReportTargetType)
  targetType!: ReportTargetType;

  @ApiProperty()
  @IsUUID()
  targetId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
