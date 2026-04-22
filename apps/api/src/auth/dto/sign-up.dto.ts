import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@stomvp/shared';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class SignUpDto {
  @ApiProperty()
  @IsString()
  fullName!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty()
  @MinLength(6)
  password!: string;

  @ApiProperty()
  @IsString()
  verificationToken!: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  @IsEnum(UserRole)
  role!: UserRole;
}
