import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { RequestSignUpCodeDto } from './dto/request-sign-up-code.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { VerifySignUpCodeDto } from './dto/verify-sign-up-code.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Rate-limit: 3 SMS requests per minute per IP. Each call hits the
  // paid DevSMS gateway, so an unprotected endpoint is a financial DoS
  // vector (~$1 per 25 requests). 4th request from the same IP within
  // 60s gets HTTP 429.
  @Throttle({ sms: { limit: 3, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  @Post('register/request-code')
  requestSignUpCode(@Body() dto: RequestSignUpCodeDto) {
    return this.authService.requestSignUpCode(dto);
  }

  @Post('register/verify-code')
  verifySignUpCode(@Body() dto: VerifySignUpCodeDto) {
    return this.authService.verifySignUpCode(dto);
  }

  @Post('register')
  register(@Body() dto: SignUpDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: SignInDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.authService.me(user.sub);
  }
}
