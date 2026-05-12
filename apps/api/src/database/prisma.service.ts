import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  // NestJS calls this when the app receives a shutdown signal
  // (provided main.ts opted in via `app.enableShutdownHooks()`).
  // We close the pool cleanly so PM2 reload doesn't leave dangling
  // Postgres connections.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
