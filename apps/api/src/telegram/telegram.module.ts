import { Global, Module } from '@nestjs/common';
import { TelegramClient } from './telegram.client';

/**
 * Global so any feature module (auth SMS-balance alerts, tester monitor,
 * future ops alerts) can inject TelegramClient without re-importing.
 */
@Global()
@Module({
  providers: [TelegramClient],
  exports: [TelegramClient],
})
export class TelegramModule {}
