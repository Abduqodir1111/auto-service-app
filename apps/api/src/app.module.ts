import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.schema';
import { PrismaModule } from './database/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { WorkshopsModule } from './workshops/workshops.module';
import { ReviewsModule } from './reviews/reviews.module';
import { FavoritesModule } from './favorites/favorites.module';
import { ApplicationsModule } from './applications/applications.module';
import { UploadsModule } from './uploads/uploads.module';
import { AdminModule } from './admin/admin.module';
import { DevicesModule } from './devices/devices.module';
import { ReportsModule } from './reports/reports.module';
import { HealthModule } from './health/health.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ServiceCallsModule } from './service-calls/service-calls.module';
import { TesterMonitorModule } from './tester-monitor/tester-monitor.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Global rate-limit: 150 req/min per IP across all endpoints. Sane
    // default that legit users (incl. service-call polling at ~30 req/min)
    // never hit, but a brute-force / scraper / spammer hits immediately.
    // Stricter caps are applied per-route via @Throttle({ default: {...} }):
    //   - /auth/register/request-code: 3/min  (DevSMS is paid)
    //   - /analytics/event:            60/min (in-house event collector)
    // `app.set('trust proxy', 1)` in main.ts makes req.ip resolve to the
    // real client behind nginx, not 127.0.0.1.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 150,
      },
    ]),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    WorkshopsModule,
    ReviewsModule,
    FavoritesModule,
    ApplicationsModule,
    UploadsModule,
    DevicesModule,
    ReportsModule,
    AdminModule,
    HealthModule,
    AnalyticsModule,
    ServiceCallsModule,
    TesterMonitorModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
