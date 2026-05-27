import { IsString, MinLength } from 'class-validator';

export class RequestPasswordResetCodeDto {
  @IsString()
  @MinLength(6)
  phone!: string;
}
