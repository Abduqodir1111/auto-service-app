import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number) {
    const payload = JSON.stringify(value);

    if (ttlSeconds) {
      await this.redis.set(key, payload, 'EX', ttlSeconds);
      return;
    }

    await this.redis.set(key, payload);
  }

  async delete(key: string) {
    await this.redis.del(key);
  }

  async deleteByPrefix(prefix: string) {
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${prefix}*`,
        'COUNT',
        100,
      );

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      cursor = nextCursor;
    } while (cursor !== '0');
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
