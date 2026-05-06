import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole as DbUserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@stomvp/shared';
import { compare, hash } from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly smsAuthService: SmsAuthService,
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
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }

    return this.buildAuthResponse(user.id);
  }

  async me(userId: string) {
    const user = await this.usersService.getByIdOrThrow(userId);
    return this.usersService.serialize(user);
  }

  private async buildAuthResponse(userId: string) {
    const user = await this.usersService.getByIdOrThrow(userId);
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role as UserRole,
      phone: user.phone,
    });

    return {
      accessToken,
      user: this.usersService.serialize(user),
    };
  }
}
