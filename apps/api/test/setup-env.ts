// Loaded by Jest (setupFiles) BEFORE module imports in any test file.
// Reads .env.test into process.env so NestJS ConfigModule finds the right
// DATABASE_URL / REDIS_URL / JWT_SECRET etc. when AppModule boots.

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '..', '.env.test') });
