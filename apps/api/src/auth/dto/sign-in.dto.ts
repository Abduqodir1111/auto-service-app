import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SignInDto {
  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty()
  @MinLength(6)
  password!: string;
}
