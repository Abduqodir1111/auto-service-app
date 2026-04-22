import { Request } from 'express';

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, '');
}

export function getRequestOrigin(request?: Request) {
  if (!request) {
    return undefined;
  }

  const forwardedProto = request.headers['x-forwarded-proto'];
  const forwardedHost = request.headers['x-forwarded-host'];

  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto?.split(',')[0]?.trim() || request.protocol || 'http';
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost?.split(',')[0]?.trim() || request.get('host');

  if (!host) {
    return undefined;
  }

  return `${protocol}://${host}`;
}

export function buildUploadsProxyUrl(key: string, origin?: string) {
  const fallbackOrigin = process.env.APP_URL ?? 'http://localhost:3100';
  const baseUrl = normalizeBaseUrl(origin ?? fallbackOrigin);

  return `${baseUrl}/api/uploads/file?key=${encodeURIComponent(key)}`;
}
