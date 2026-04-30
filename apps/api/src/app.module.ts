import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Rate-limiter: not applied globally (no APP_GUARD). Specific
    // endpoints opt in via @UseGuards(ThrottlerGuard) + @Throttle().
    // Currently used by /auth/register/request-code to prevent SMS flooding
    // (each request hits paid DevSMS, so an unprotected endpoint = $$$ leak).
    ThrottlerModule.forRoot([
      {
        name: 'sms',
        ttl: 60_000,
        limit: 3,
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
  ],
})
export class AppModule {}
