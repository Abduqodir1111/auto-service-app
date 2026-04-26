import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class VerifyMasterDto {
  @ApiProperty()
  @IsBoolean()
  isVerifiedMaster!: boolean;
}
