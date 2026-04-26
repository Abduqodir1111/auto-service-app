import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevicesService } from './devices.service';

/**
 * Payload accepted by Expo's push API. We expose just the bits we use,
 * the full type is documented at https://docs.expo.dev/push-notifications/sending-notifications/
 */
export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: 'default';
  priority: 'high';
  channelId?: string;
};

type ExpoTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Fire-and-forget push notification helper.
 * Methods never throw — a failed push must NOT roll back the surrounding
 * business action (e.g. don't refuse to create an Application just because
 * the master's phone is offline).
 */
@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    private readonly devicesService: DevicesService,
    private readonly configService: ConfigService,
  ) {}

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    try {
      const tokens = await this.devicesService.getTokensForUser(userId);
      if (tokens.length === 0) return;
      await this.sendToTokens(tokens, payload);
    } catch (err) {
      this.logger.warn(`sendToUser(${userId}) failed: ${(err as Error).message}`);
    }
  }

  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    await Promise.all(userIds.map((id) => this.sendToUser(id, payload)));
  }

  private async sendToTokens(tokens: string[], payload: PushPayload): Promise<void> {
    // Skip in test environment so jest specs don't hit the network.
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      this.logger.debug(`[test] skip push to ${tokens.length} tokens: ${payload.title}`);
      return;
    }

    const messages: ExpoMessage[] = tokens.map((token) => ({
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: 'default',
      priority: 'high',
      channelId: 'default',
    }));

    let response: Response;
    try {
      response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });
    } catch (err) {
      this.logger.warn(`Expo push request failed: ${(err as Error).message}`);
      return;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '<no-body>');
      this.logger.warn(`Expo push HTTP ${response.status}: ${text.slice(0, 200)}`);
      return;
    }

    let body: { data?: ExpoTicket[] };
    try {
      body = (await response.json()) as { data?: ExpoTicket[] };
    } catch {
      this.logger.warn('Expo push: response was not JSON');
      return;
    }

    const tickets = body.data ?? [];
    const tokensToPrune: string[] = [];
    tickets.forEach((ticket, index) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        tokensToPrune.push(tokens[index]);
      } else if (ticket.status === 'error') {
        this.logger.warn(`Expo ticket error for token ${tokens[index]}: ${ticket.message}`);
      }
    });

    if (tokensToPrune.length > 0) {
      this.logger.log(`Pruning ${tokensToPrune.length} stale device token(s)`);
      await this.devicesService.pruneTokens(tokensToPrune).catch((err) => {
        this.logger.warn(`Token prune failed: ${(err as Error).message}`);
      });
    }
  }
}
