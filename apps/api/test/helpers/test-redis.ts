// Wipes the test Redis between tests so OTP / verification tokens from one
// test never leak into the next. Uses Redis' FLUSHDB which only nukes the
// CURRENTLY selected DB — and our test compose runs an isolated instance,
// so nothing else lives on it.

import Redis from 'ioredis';

let client: Redis | null = null;

function getRedisClient(): Redis {
  if (!client) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error('REDIS_URL is not set in the test environment');
    }
    client = new Redis(url, { lazyConnect: false });
  }
  return client;
}

export async function flushTestRedis(): Promise<void> {
  const c = getRedisClient();
  await c.flushdb();
}

export async function disconnectTestRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
