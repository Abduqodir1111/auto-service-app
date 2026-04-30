import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import { REDIS } from '../redis/redis.constants';
import { UploadsService } from '../uploads/uploads.service';

const CHECK_TIMEOUT_MS = 3000;

type CheckStatus = 'ok' | string;

interface HealthChecks {
  database: CheckStatus;
  redis: CheckStatus;
  storage: CheckStatus;
}

export interface HealthReport {
  ok: boolean;
  checks: HealthChecks;
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly uploadsService: UploadsService,
  ) {}

  async check(): Promise<HealthReport> {
    const [database, redis, storage] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage(),
    ]);

    const checks: HealthChecks = {
      database: this.format(database),
      redis: this.format(redis),
      storage: this.format(storage),
    };

    const ok = Object.values(checks).every((status) => status === 'ok');

    return {
      ok,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<void> {
    await this.withTimeout(
      this.prisma.$queryRaw`SELECT 1`,
      'database did not respond in time',
    );
  }

  private async checkRedis(): Promise<void> {
    const reply = await this.withTimeout(
      this.redis.ping(),
      'redis did not respond in time',
    );
    if (reply !== 'PONG') {
      throw new Error(`unexpected redis reply: ${reply}`);
    }
  }

  private async checkStorage(): Promise<void> {
    await this.withTimeout(
      this.uploadsService.healthCheck(),
      'storage did not respond in time',
    );
  }

  private async withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), CHECK_TIMEOUT_MS);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private format(result: PromiseSettledResult<unknown>): CheckStatus {
    if (result.status === 'fulfilled') return 'ok';
    const reason = result.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    return `down: ${message}`;
  }
}
