import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class BlockUserDto {
  @ApiProperty()
  @IsBoolean()
  isBlocked!: boolean;
}
