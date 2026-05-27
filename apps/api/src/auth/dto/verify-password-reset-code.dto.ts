import { IsString, Length, MinLength } from 'class-validator';

export class VerifyPasswordResetCodeDto {
  @IsString()
  @MinLength(6)
  phone!: string;

  @IsString()
  @Length(4, 8)
  code!: string;
}
