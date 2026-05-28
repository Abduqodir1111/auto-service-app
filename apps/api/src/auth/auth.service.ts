import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserRole as DbUserRole } from '@prisma/client';
import { UserRole } from '@stomvp/shared';
import { compare, hash } from 'bcrypt';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import { REDIS } from '../redis/redis.constants';
import { UsersService } from '../users/users.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetCodeDto } from './dto/request-password-reset-code.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { RequestSignUpCodeDto } from './dto/request-sign-up-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifySignUpCodeDto } from './dto/verify-sign-up-code.dto';
import { VerifyPasswordResetCodeDto } from './dto/verify-password-reset-code.dto';
import { ConfirmAccountDeleteDto } from './dto/confirm-account-delete.dto';
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
const REFRESH_TOKEN_BYTES = 48;
const MAX_STORED_USER_AGENT_LENGTH = 255;
const MAX_STORED_IP_LENGTH = 64;

type RefreshContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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

  async requestPasswordResetCode(dto: RequestPasswordResetCodeDto) {
    const normalizedPhone = formatUzPhoneForStorage(dto.phone);
    const user = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true, isBlocked: true },
    });

    return this.smsAuthService.requestPasswordResetCode(
      normalizedPhone,
      Boolean(user && !user.isBlocked),
    );
  }

  async verifyPasswordResetCode(dto: VerifyPasswordResetCodeDto) {
    return this.smsAuthService.verifyPasswordResetCode(dto.phone, dto.code);
  }

  async resetPassword(dto: ResetPasswordDto) {
    const normalizedPhone = await this.smsAuthService.consumeVerifiedPasswordReset(
      dto.phone,
      dto.verificationToken,
    );

    const user = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true, isBlocked: true },
    });

    if (!user) {
      throw new BadRequestException('Аккаунт не найден. Запросите SMS-код ещё раз.');
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }

    const passwordHash = await hash(dto.newPassword, 10);
    const revokedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.refreshSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt },
      }),
    ]);

    await this.redis.del(LOGIN_FAIL_KEY(normalizedPhone), LOGIN_LOCK_KEY(normalizedPhone));

    return { success: true };
  }

  async requestAccountDeletionCode(userId: string) {
    const user = await this.usersService.getByIdOrThrow(userId);

    if (user.isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }

    return this.smsAuthService.requestAccountDeletionCode(user.phone);
  }

  async confirmAccountDeletion(userId: string, dto: ConfirmAccountDeleteDto) {
    const user = await this.usersService.getByIdOrThrow(userId);

    if (user.isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }

    await this.smsAuthService.verifyAccountDeletionCode(user.phone, dto.code);
    return this.usersService.deleteAccount(userId);
  }

  async register(dto: SignUpDto, request?: Request) {
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

    return this.buildAuthResponse(user.id, this.getRefreshContext(request));
  }

  async login(dto: SignInDto, request?: Request) {
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
    return this.buildAuthResponse(user.id, this.getRefreshContext(request));
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

  async refresh(dto: RefreshTokenDto, request?: Request) {
    const parsed = this.parseRefreshToken(dto.refreshToken);
    if (!parsed) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.refreshSession.findUnique({
      where: { id: parsed.sessionId },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !this.tokenHashesMatch(session.tokenHash, this.hashRefreshSecret(parsed.secret))
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.user.isBlocked) {
      await this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Account is blocked');
    }

    const context = this.getRefreshContext(request);

    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      if (revoked.count !== 1) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const refreshToken = await this.issueRefreshSession(tx, session.userId, context);
      const accessToken = await this.signAccessToken(session.user);

      return {
        accessToken,
        refreshToken,
        user: this.usersService.serialize(session.user),
      };
    });
  }

  async logout(dto: RefreshTokenDto) {
    const parsed = this.parseRefreshToken(dto.refreshToken);
    if (!parsed) {
      return { success: true };
    }

    await this.prisma.refreshSession.updateMany({
      where: {
        id: parsed.sessionId,
        tokenHash: this.hashRefreshSecret(parsed.secret),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  private async buildAuthResponse(userId: string, context: RefreshContext) {
    const user = await this.usersService.getByIdOrThrow(userId);
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user),
      this.issueRefreshSession(this.prisma, user.id, context),
    ]);

    return {
      accessToken,
      refreshToken,
      user: this.usersService.serialize(user),
    };
  }

  private signAccessToken(user: Pick<User, 'id' | 'role'>) {
    // JWT payload is intentionally minimal — no PII. Phone, name and
    // any other fields are looked up from the DB by `sub` in JwtStrategy.validate().
    return this.jwtService.signAsync({
      sub: user.id,
      role: user.role as UserRole,
    });
  }

  private async issueRefreshSession(
    client: Prisma.TransactionClient | PrismaService,
    userId: string,
    context: RefreshContext,
  ) {
    await client.refreshSession.deleteMany({
      where: {
        userId,
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    const id = randomUUID();
    const secret = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const ttlDays = Number(this.configService.get<number | string>('REFRESH_TOKEN_TTL_DAYS', 30));
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await client.refreshSession.create({
      data: {
        id,
        userId,
        tokenHash: this.hashRefreshSecret(secret),
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt,
      },
    });

    return `${id}.${secret}`;
  }

  private parseRefreshToken(token: string) {
    const [sessionId, secret, ...rest] = token.split('.');

    if (!sessionId || !secret || rest.length > 0) {
      return null;
    }

    return { sessionId, secret };
  }

  private hashRefreshSecret(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }

  private tokenHashesMatch(expectedHex: string, actualHex: string) {
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = Buffer.from(actualHex, 'hex');

    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private getRefreshContext(request?: Request): RefreshContext {
    if (!request) {
      return {};
    }

    const forwardedFor = request.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0]?.trim();
    const ipAddress = (forwardedIp || request.ip || request.socket.remoteAddress || '').slice(
      0,
      MAX_STORED_IP_LENGTH,
    );
    const userAgent = (request.headers['user-agent'] || '').slice(
      0,
      MAX_STORED_USER_AGENT_LENGTH,
    );

    return {
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
    };
  }
}
