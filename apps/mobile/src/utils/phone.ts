export function normalizePhoneForApi(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return trimmed;
  }

  if (digits.startsWith('998')) {
    return `+${digits}`;
  }

  if (digits.length === 9) {
    return `+998${digits}`;
  }

  if (digits.startsWith('00') && digits.length > 2) {
    return `+${digits.slice(2)}`;
  }

  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

export function isLikelyPhone(value: string) {
  return normalizePhoneForApi(value).replace(/\D/g, '').length >= 9;
}
