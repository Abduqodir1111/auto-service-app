import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Tiny Telegram Bot API wrapper. We don't need a heavy SDK — only a single
 * sendMessage call with chat_id + text. Token + chat live in env vars
 * (TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID); same bot used by the
 * existing PM2 watcher (`@mastertop_alerts_bot`, chat 257363972).
 *
 * Failures are swallowed: a flaky Telegram outage must NEVER take down a
 * production NestJS request — Telegram is best-effort notification, not
 * a contract.
 */
@Injectable()
export class TelegramClient {
  private readonly logger = new Logger(TelegramClient.name);

  constructor(private readonly config: ConfigService) {}

  async sendAdminMessage(text: string): Promise<boolean> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.config.get<string>('TELEGRAM_ADMIN_CHAT_ID');
    if (!token || !chatId) {
      this.logger.warn('Telegram bot token/chat not configured — skipping send');
      return false;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '<no body>');
        this.logger.warn(`Telegram sendMessage HTTP ${response.status}: ${body.slice(0, 200)}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`Telegram sendMessage failed: ${(err as Error).message}`);
      return false;
    }
  }
}
