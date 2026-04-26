import { ApiProperty } from '@nestjs/swagger';
import { DevicePlatform } from '@prisma/client';
import { IsEnum, IsString, Matches } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    description: 'Expo push token returned by getExpoPushTokenAsync() on the device.',
  })
  @IsString()
  @Matches(/^ExponentPushToken\[[A-Za-z0-9_\-]+\]$/, {
    message: 'token must look like ExponentPushToken[…]',
  })
  token!: string;

  @ApiProperty({ enum: DevicePlatform, enumName: 'DevicePlatform' })
  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;
}
