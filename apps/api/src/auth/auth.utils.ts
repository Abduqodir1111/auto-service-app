import { BadRequestException } from '@nestjs/common';

function extractDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function formatUzPhoneForStorage(phone: string) {
  const digits = extractDigits(phone);

  if (digits.length === 9) {
    return `+998${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('998')) {
    return `+${digits}`;
  }

  throw new BadRequestException('Укажите телефон в формате +998901234567');
}

export function formatUzPhoneForSms(phone: string) {
  return formatUzPhoneForStorage(phone).slice(1);
}
