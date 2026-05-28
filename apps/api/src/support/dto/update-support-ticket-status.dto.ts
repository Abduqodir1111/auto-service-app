import { SupportTicketStatus } from '@stomvp/shared';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSupportTicketStatusDto {
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolution?: string;
}
