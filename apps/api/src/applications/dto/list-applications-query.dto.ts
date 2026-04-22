import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class ListApplicationsQueryDto {
  @ApiPropertyOptional({ enum: ['sent', 'received'] })
  @IsOptional()
  @IsIn(['sent', 'received'])
  scope?: 'sent' | 'received';
}
