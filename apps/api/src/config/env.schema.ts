import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3100),
  APP_URL: z.string().url().default('http://localhost:3100'),
  WEB_URL: z.string().default('http://localhost:5173'),
  MOBILE_DEEP_LINK: z.string().default('mastertop://'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  REDIS_URL: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().default('us-east-1'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_PUBLIC_URL: z.string().url().optional(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  DEVSMS_API_BASE_URL: z.string().url().default('https://devsms.uz/api'),
  DEVSMS_API_TOKEN: z.string().min(1).optional(),
  SMS_SERVICE_NAME: z.string().min(2).default('MasterTop'),
  SMS_OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  SMS_OTP_RESEND_SECONDS: z.coerce.number().int().positive().default(60),
  SMS_OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  // Optional: Telegram bot for admin alerts (tester activity report,
  // future PM2-style alerts). Same `@mastertop_alerts_bot` already used
  // by /opt/stomvp/pm2-watcher.py.
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_ADMIN_CHAT_ID: z.string().min(1).optional(),
  // Optional: Sentry error tracking. When unset, Sentry SDK init is a no-op
  // (see instrument.ts) and nothing is reported. SENTRY_RELEASE is filled by
  // deploy.sh from current git commit hash so issues are tagged by release.
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().min(1).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  return envSchema.parse(config);
}
