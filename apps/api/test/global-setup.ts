// Runs ONCE before the whole jest run.
// 1. Load .env.test
// 2. Push the Prisma schema to the test DB so tables exist.
//
// The test DB is wiped + reseeded between test files via helpers/test-db.ts,
// but the schema itself only needs to be created once per jest run.

import { config } from 'dotenv';
import { execSync } from 'child_process';
import { resolve } from 'path';

export default async function globalSetup() {
  config({ path: resolve(__dirname, '..', '.env.test') });

  // eslint-disable-next-line no-console
  console.log('\n[test] Pushing Prisma schema to', process.env.DATABASE_URL);

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env },
    stdio: 'inherit',
  });

  // eslint-disable-next-line no-console
  console.log('[test] Schema ready. Starting tests…\n');
}
