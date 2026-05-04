import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

class SetOnlineStatusDto {
  @IsBoolean()
  isOnline!: boolean;
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: JwtUser) {
    const profile = await this.usersService.getByIdOrThrow(user.sub);
    return this.usersService.serialize(profile);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: JwtUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  /**
   * Master toggles their availability for on-demand service calls.
   * Client/admin can also call it but it has no behavioural effect for them
   * (the dispatcher only ever queries masters with role=MASTER + APPROVED workshops).
   */
  @Post('me/online-status')
  setOnlineStatus(@CurrentUser() user: JwtUser, @Body() dto: SetOnlineStatusDto) {
    return this.usersService.setOnlineStatus(user.sub, dto.isOnline);
  }

  @Delete('me')
  deleteAccount(@CurrentUser() user: JwtUser) {
    return this.usersService.deleteAccount(user.sub);
  }
}
