import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifySignUpCodeDto {
  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty()
  @IsString()
  @Length(4, 8)
  code!: string;
}
