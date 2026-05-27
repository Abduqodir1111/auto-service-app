import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(6)
  phone!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;

  @IsString()
  @MinLength(10)
  verificationToken!: string;
}
