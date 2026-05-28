import { SupportTicketType } from '@stomvp/shared';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsEnum(SupportTicketType)
  type!: SupportTicketType;

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: string;
}
