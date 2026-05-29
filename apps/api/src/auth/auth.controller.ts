import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetCodeDto } from './dto/request-password-reset-code.dto';
import { ConfirmAccountDeleteDto } from './dto/confirm-account-delete.dto';
import { RequestSignUpCodeDto } from './dto/request-sign-up-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { VerifyPasswordResetCodeDto } from './dto/verify-password-reset-code.dto';
import { VerifySignUpCodeDto } from './dto/verify-sign-up-code.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Override default 150/min → 3/min. Each call hits the paid DevSMS
  // gateway, so an unprotected endpoint is a financial DoS vector
  // (~$1 per 25 requests). 4th request from the same IP within 60s gets HTTP 429.
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register/request-code')
  requestSignUpCode(@Body() dto: RequestSignUpCodeDto) {
    return this.authService.requestSignUpCode(dto);
  }

  @Post('register/verify-code')
  verifySignUpCode(@Body() dto: VerifySignUpCodeDto) {
    return this.authService.verifySignUpCode(dto);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('password-reset/request-code')
  requestPasswordResetCode(@Body() dto: RequestPasswordResetCodeDto) {
    return this.authService.requestPasswordResetCode(dto);
  }

  @Post('password-reset/verify-code')
  verifyPasswordResetCode(@Body() dto: VerifyPasswordResetCodeDto) {
    return this.authService.verifyPasswordResetCode(dto);
  }

  @Post('password-reset/confirm')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('account-delete/request-code')
  requestAccountDeletionCode(@CurrentUser() user: JwtUser) {
    return this.authService.requestAccountDeletionCode(user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('account-delete/confirm')
  confirmAccountDeletion(
    @CurrentUser() user: JwtUser,
    @Body() dto: ConfirmAccountDeleteDto,
  ) {
    return this.authService.confirmAccountDeletion(user.sub, dto);
  }

  @Post('register')
  register(@Body() dto: SignUpDto, @Req() request: Request) {
    return this.authService.register(dto, request);
  }

  @Post('login')
  login(@Body() dto: SignInDto, @Req() request: Request) {
    return this.authService.login(dto, request);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(dto, request);
  }

  @Post('session/upgrade')
  upgradeLegacySession(@Req() request: Request) {
    return this.authService.upgradeLegacySession(request);
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.authService.me(user.sub);
  }
}
