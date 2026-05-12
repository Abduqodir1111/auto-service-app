import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole as DbUserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@stomvp/shared';
import { compare, hash } from 'bcrypt';
import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import { REDIS } from '../redis/redis.constants';
import { UsersService } from '../users/users.service';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { RequestSignUpCodeDto } from './dto/request-sign-up-code.dto';
import { VerifySignUpCodeDto } from './dto/verify-sign-up-code.dto';
import { formatUzPhoneForStorage } from './auth.utils';
import { SmsAuthService } from './sms-auth.service';

// Precomputed bcrypt hash (cost 10) used as a comparand when the supplied
// phone has no matching user. Running compare() against this dummy makes
// "unknown phone" take the same wall-clock time as "wrong password against
// a real account" — otherwise an attacker can enumerate registered numbers
// by measuring login response time.
const DUMMY_PASSWORD_HASH =
  '$2b$10$TUyKoA58DBCmovoscHH4IuCy4Dpqp1VgnT1thetnls.taaEl8O2jG';

// Brute-force lockout: track failed login attempts in Redis keyed by phone.
// After MAX_ATTEMPTS bad passwords within ATTEMPT_WINDOW_SECONDS, lock the
// phone for LOCKOUT_SECONDS. fail2ban already blocks IPs at the nginx layer
// for excessive 401s; this layer blocks at the *account* level, so a
// distributed attack (botnet, rotated IPs) can't pin a known phone.
const LOGIN_FAIL_KEY = (phone: string) => `auth:login:fail:${phone}`;
const LOGIN_LOCK_KEY = (phone: string) => `auth:login:lock:${phone}`;
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_SECONDS = 15 * 60; // 15 min sliding counter
const LOCKOUT_SECONDS = 15 * 60; // 15 min lock after the 5th fail

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly smsAuthService: SmsAuthService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async requestSignUpCode(dto: RequestSignUpCodeDto) {
    return this.smsAuthService.requestSignUpCode(dto.phone);
  }

  async verifySignUpCode(dto: VerifySignUpCodeDto) {
    return this.smsAuthService.verifySignUpCode(dto.phone, dto.code);
  }

  async register(dto: SignUpDto) {
    if (dto.role === UserRole.ADMIN) {
      throw new BadRequestException('Admin registration is not available in public flow');
    }

    const normalizedPhone = formatUzPhoneForStorage(dto.phone);

    const [existingByPhone, existingByEmail] = await Promise.all([
      this.prisma.user.findUnique({ where: { phone: normalizedPhone } }),
      dto.email ? this.prisma.user.findUnique({ where: { email: dto.email } }) : null,
    ]);

    if (existingByPhone) {
      throw new ConflictException('Phone number is already registered');
    }

    if (existingByEmail) {
      throw new ConflictException('Email is already registered');
    }

    await this.smsAuthService.consumeVerifiedPhone(dto.phone, dto.verificationToken);

    const passwordHash = await hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        phone: normalizedPhone,
        email: dto.email,
        passwordHash,
        role: DbUserRole[dto.role as keyof typeof DbUserRole],
      },
    });

    return this.buildAuthResponse(user.id);
  }

  async login(dto: SignInDto) {
    const normalizedPhone = formatUzPhoneForStorage(dto.phone);

    // Lockout check happens first — even before DB lookup — so a locked
    // phone gets a uniform fast reject regardless of whether the password
    // is right or wrong.
    const lockTtl = await this.redis.ttl(LOGIN_LOCK_KEY(normalizedPhone));
    if (lockTtl > 0) {
      throw new HttpException(
        {
          message: `Слишком много неудачных попыток. Повторите через ${Math.ceil(lockTtl / 60)} мин.`,
          retryAfterSeconds: lockTtl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    // Always run bcrypt — dummy hash when no user — so every failure path
    // takes the same wall-clock time. Prevents phone-number enumeration.
    const passwordMatches = await compare(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches) {
      await this.recordLoginFailure(normalizedPhone);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }

    // Success — wipe the failure counter so the next bad login starts
    // fresh, not from a near-locked state.
    await this.redis.del(LOGIN_FAIL_KEY(normalizedPhone));
    return this.buildAuthResponse(user.id);
  }

  private async recordLoginFailure(phone: string) {
    const key = LOGIN_FAIL_KEY(phone);
    const count = await this.redis.incr(key);
    if (count === 1) {
      // First fail in the window — start the expiry.
      await this.redis.expire(key, ATTEMPT_WINDOW_SECONDS);
    }
    if (count >= MAX_ATTEMPTS) {
      await this.redis.set(LOGIN_LOCK_KEY(phone), '1', 'EX', LOCKOUT_SECONDS);
      await this.redis.del(key);
    }
  }

  async me(userId: string) {
    const user = await this.usersService.getByIdOrThrow(userId);
    return this.usersService.serialize(user);
  }

  private async buildAuthResponse(userId: string) {
    const user = await this.usersService.getByIdOrThrow(userId);
    // JWT payload is intentionally minimal — no PII. Phone, name and
    // any other fields are looked up from the DB by `sub` in JwtStrategy.validate().
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role as UserRole,
    });

    return {
      accessToken,
      user: this.usersService.serialize(user),
    };
  }
}
