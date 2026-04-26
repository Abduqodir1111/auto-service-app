import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { formatUzPhoneForSms, formatUzPhoneForStorage } from './auth.utils';

type PendingSignUpCode = {
  phone: string;
  codeHash: string;
  expiresAt: string;
  resendAvailableAt: string;
  attemptsLeft: number;
};

type VerifiedSignUpPhone = {
  phone: string;
};

@Injectable()
export class SmsAuthService {
  private readonly providerBaseUrl: string;
  private readonly providerToken?: string;
  private readonly serviceName: string;
  private readonly otpTtlSeconds: number;
  private readonly resendSeconds: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.providerBaseUrl = this.configService.get<string>(
      'DEVSMS_API_BASE_URL',
      'https://devsms.uz/api',
    );
    this.providerToken = this.configService.get<string>('DEVSMS_API_TOKEN');
    this.serviceName = this.configService.get<string>('SMS_SERVICE_NAME', 'MasterTop');
    this.otpTtlSeconds = this.configService.get<number>('SMS_OTP_TTL_SECONDS', 300);
    this.resendSeconds = this.configService.get<number>('SMS_OTP_RESEND_SECONDS', 60);
    this.maxAttempts = this.configService.get<number>('SMS_OTP_MAX_ATTEMPTS', 5);
  }

  async requestSignUpCode(phone: string) {
    const normalizedPhone = formatUzPhoneForStorage(phone);
    const smsPhone = formatUzPhoneForSms(phone);

    const existingUser = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (existingUser) {
      throw new ConflictException('Этот номер уже зарегистрирован');
    }

    const key = this.getSignUpCodeKey(normalizedPhone);
    const existingCode = await this.redisService.getJson<PendingSignUpCode>(key);
    const now = Date.now();

    if (existingCode) {
      const resendAt = new Date(existingCode.resendAvailableAt).getTime();

      if (resendAt > now) {
        throw new HttpException(
          `Повторный код можно запросить через ${Math.ceil((resendAt - now) / 1000)} сек.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const code = this.generateCode();
    await this.sendRegistrationOtpSms(smsPhone, code);

    const payload: PendingSignUpCode = {
      phone: normalizedPhone,
      codeHash: this.hashCode(normalizedPhone, code),
      expiresAt: new Date(now + this.otpTtlSeconds * 1000).toISOString(),
      resendAvailableAt: new Date(now + this.resendSeconds * 1000).toISOString(),
      attemptsLeft: this.maxAttempts,
    };

    await this.redisService.setJson(key, payload, this.otpTtlSeconds);

    return {
      success: true,
      expiresIn: this.otpTtlSeconds,
      resendIn: this.resendSeconds,
    };
  }

  async verifySignUpCode(phone: string, code: string) {
    const normalizedPhone = formatUzPhoneForStorage(phone);
    const key = this.getSignUpCodeKey(normalizedPhone);
    const pending = await this.redisService.getJson<PendingSignUpCode>(key);

    if (!pending) {
      throw new BadRequestException('Код истёк. Запросите новый SMS-код.');
    }

    if (pending.phone !== normalizedPhone) {
      throw new BadRequestException('Телефон для подтверждения не совпадает');
    }

    const expectedHash = this.hashCode(normalizedPhone, code);

    if (pending.codeHash !== expectedHash) {
      const attemptsLeft = pending.attemptsLeft - 1;

      if (attemptsLeft <= 0) {
        await this.redisService.delete(key);
        throw new BadRequestException('Код введён неверно слишком много раз. Запросите новый.');
      }

      await this.redisService.setJson(
        key,
        {
          ...pending,
          attemptsLeft,
        },
        Math.max(1, Math.ceil((new Date(pending.expiresAt).getTime() - Date.now()) / 1000)),
      );

      throw new BadRequestException(
        `Неверный код. Осталось попыток: ${attemptsLeft}.`,
      );
    }

    await this.redisService.delete(key);

    const verificationToken = randomUUID();
    await this.redisService.setJson(
      this.getVerifiedPhoneKey(verificationToken),
      {
        phone: normalizedPhone,
      } satisfies VerifiedSignUpPhone,
      15 * 60,
    );

    return {
      verificationToken,
      expiresIn: 15 * 60,
    };
  }

  async consumeVerifiedPhone(phone: string, verificationToken: string) {
    const normalizedPhone = formatUzPhoneForStorage(phone);
    const key = this.getVerifiedPhoneKey(verificationToken);
    const payload = await this.redisService.getJson<VerifiedSignUpPhone>(key);

    if (!payload) {
      throw new BadRequestException('Подтверждение телефона истекло. Подтвердите номер ещё раз.');
    }

    if (payload.phone !== normalizedPhone) {
      throw new BadRequestException('Подтверждение относится к другому номеру телефона.');
    }

    await this.redisService.delete(key);

    return normalizedPhone;
  }

  private async sendRegistrationOtpSms(phone: string, code: string) {
    if (!this.providerToken) {
      if (this.configService.get<string>('NODE_ENV') !== 'production') {
        console.log(`[DevSMS disabled] Registration OTP for ${phone}: ${code}`);
        return;
      }

      throw new ServiceUnavailableException('SMS provider is not configured');
    }

    const response = await fetch(`${this.providerBaseUrl}/send_sms.php`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.providerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone,
        type: 'universal_otp',
        template_type: 3,
        service_name: this.serviceName,
        otp_code: code,
      }),
    });

    let payload: { success?: boolean; error?: string; message?: string };

    try {
      payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };
    } catch {
      throw new BadGatewayException('SMS provider returned an invalid response');
    }

    if (!response.ok || !payload.success) {
      throw new BadGatewayException(
        payload.error || payload.message || 'Не удалось отправить SMS-код',
      );
    }
  }

  private getSignUpCodeKey(phone: string) {
    return `auth:sms:signup:code:${phone}`;
  }

  private getVerifiedPhoneKey(token: string) {
    return `auth:sms:signup:verified:${token}`;
  }

  private generateCode() {
    return String(randomInt(10000, 100000));
  }

  private hashCode(phone: string, code: string) {
    return createHash('sha256')
      .update(`${phone}:${code}:${this.configService.getOrThrow<string>('JWT_SECRET')}`)
      .digest('hex');
  }
}
