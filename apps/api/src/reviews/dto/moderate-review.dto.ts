import { ApiProperty } from '@nestjs/swagger';
import { ReviewStatus } from '@stomvp/shared';
import { IsEnum } from 'class-validator';

export class ModerateReviewDto {
  @ApiProperty({ enum: ReviewStatus, enumName: 'ReviewStatus' })
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}
