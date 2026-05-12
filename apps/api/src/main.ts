// Must be the first import — Sentry's auto-instrumentation needs to patch
// modules before they're loaded. See instrument.ts for rationale.
import './instrument';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // Whitelist: only browser origins listed here can call the API.
  // Mobile (React Native) bypasses CORS entirely. Prod sets
  // WEB_URL=https://admin.nedvigagregat.uz; dev defaults to vite on :5173.
  // Requests without an Origin header (curl, mobile, server-to-server)
  // are unaffected — CORS only restricts browser-initiated cross-origin.
  const corsOrigin = process.env.WEB_URL ?? 'http://localhost:5173';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: [corsOrigin],
    },
  });

  // nginx terminates TLS and forwards the real client IP via
  // X-Forwarded-For. Trust the first hop so req.ip resolves to the
  // real client (not 127.0.0.1) — required for accurate rate-limiting.
  app.set('trust proxy', 1);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MasterTop API')
    .setDescription('MVP API для платформы поиска СТО и автомастеров')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Listen for SIGTERM/SIGINT from PM2 reload. With this on, NestJS will
  // wait for in-flight HTTP requests, then call OnModuleDestroy hooks
  // (PrismaService.$disconnect, RedisService.quit, etc.) before exiting.
  // Without it, PM2 reload abruptly kills the process mid-request.
  app.enableShutdownHooks();

  await app.listen(process.env.PORT || 3000);
}

bootstrap();
