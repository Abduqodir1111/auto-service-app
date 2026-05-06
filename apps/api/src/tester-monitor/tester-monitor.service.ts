import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { TelegramClient } from './telegram.client';

/**
 * Daily report on Closed-Testing tester activity. Pulls every user marked
 * with `isTester=true`, looks up their last AnalyticsEvent, classifies
 * them into 4 buckets and sends a single Telegram message to the admin.
 *
 * Why daily 04:00 UTC: that's 09:00 Asia/Tashkent — the admin (sole user
 * of MasterTop Closed Testing) wakes up to a fresh report.
 *
 * Format: HTML so we can bold the headline counts without pulling in
 * Markdown's escaping minefield.
 */
@Injectable()
export class TesterMonitorService {
  private readonly logger = new Logger(TesterMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramClient,
  ) {}

  /**
   * 04:00 UTC every day = 09:00 Asia/Tashkent. Triggered by NestJS
   * scheduler (in-process; no external cron). NestJS Cron uses the
   * server's local TZ unless overridden — VPS is on UTC, so the literal
   * `4 * * *` works as expected.
   */
  @Cron('0 4 * * *')
  async runScheduledReport() {
    this.logger.log('Running scheduled tester activity report');
    await this.runOnce();
  }

  /**
   * Public so the admin can trigger the same report ad-hoc via an API
   * endpoint (`POST /admin/testers/report`). Useful for "send it now" or
   * for verifying Telegram wiring after deploy.
   */
  async runOnce(): Promise<{ sent: boolean; testers: number; reportText: string }> {
    const testers = await this.prisma.user.findMany({
      where: { isTester: true, role: { not: 'ADMIN' } },
      select: { id: true, fullName: true, phone: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    if (testers.length === 0) {
      const reportText = '⚠️ В БД нет пользователей с флагом <b>isTester=true</b>. Пометь тестеров через админку или SQL.';
      const sent = await this.telegram.sendAdminMessage(reportText);
      return { sent, testers: 0, reportText };
    }

    const lastSeen = await this.prisma.$queryRaw<
      Array<{ userId: string; lastSeen: Date }>
    >`
      SELECT "userId", MAX("createdAt") AS "lastSeen"
      FROM "AnalyticsEvent"
      WHERE "userId" = ANY(${testers.map((t) => t.id)}::uuid[])
      GROUP BY "userId"
    `;
    const lastSeenByUser = new Map(lastSeen.map((row) => [row.userId, row.lastSeen]));

    const now = Date.now();
    const buckets = {
      activeLast24h: [] as Array<{ name: string; phone: string; lastSeenHr: number }>,
      cooling24to48h: [] as Array<{ name: string; phone: string; lastSeenHr: number }>,
      cold48hPlus: [] as Array<{ name: string; phone: string; lastSeenHr: number; lastSeenStr: string }>,
      neverOpened: [] as Array<{ name: string; phone: string }>,
    };

    for (const t of testers) {
      const last = lastSeenByUser.get(t.id);
      if (!last) {
        buckets.neverOpened.push({ name: t.fullName, phone: t.phone });
        continue;
      }
      const hours = (now - last.getTime()) / (60 * 60 * 1000);
      const entry = { name: t.fullName, phone: t.phone, lastSeenHr: Math.round(hours) };
      if (hours <= 24) {
        buckets.activeLast24h.push(entry);
      } else if (hours <= 48) {
        buckets.cooling24to48h.push(entry);
      } else {
        buckets.cold48hPlus.push({
          ...entry,
          lastSeenStr: last.toISOString().slice(0, 10),
        });
      }
    }

    const reportText = this.formatReport(testers.length, buckets);
    const sent = await this.telegram.sendAdminMessage(reportText);
    if (sent) {
      this.logger.log(`Telegram report sent for ${testers.length} testers`);
    } else {
      this.logger.warn('Telegram report send failed (see earlier logs)');
    }
    return { sent, testers: testers.length, reportText };
  }

  private formatReport(
    total: number,
    b: {
      activeLast24h: Array<{ name: string; phone: string; lastSeenHr: number }>;
      cooling24to48h: Array<{ name: string; phone: string; lastSeenHr: number }>;
      cold48hPlus: Array<{ name: string; phone: string; lastSeenHr: number; lastSeenStr: string }>;
      neverOpened: Array<{ name: string; phone: string }>;
    },
  ): string {
    const date = new Date().toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const lines: string[] = [];
    lines.push(`📊 <b>Отчёт о тестерах MasterTop — ${date}</b>`);
    lines.push('');
    lines.push(`Всего тестеров: <b>${total}</b>`);
    lines.push(`🟢 Активных за 24ч: <b>${b.activeLast24h.length}</b>`);
    lines.push(`🟡 24-48ч не заходил: <b>${b.cooling24to48h.length}</b>`);
    lines.push(`🔴 &gt;48ч не заходил: <b>${b.cold48hPlus.length}</b>${b.cold48hPlus.length > 0 ? ' ← пинай срочно' : ''}`);
    lines.push(`⚫ Никогда не открывал: <b>${b.neverOpened.length}</b>`);

    if (b.cold48hPlus.length > 0) {
      lines.push('');
      lines.push('🔴 <b>Срочно пинай</b>:');
      for (const t of b.cold48hPlus) {
        lines.push(`• ${escapeHtml(t.name)} (<code>${t.phone}</code>) — был ${t.lastSeenStr}`);
      }
    }
    if (b.neverOpened.length > 0) {
      lines.push('');
      lines.push('⚫ <b>Никогда не заходил</b>:');
      for (const t of b.neverOpened) {
        lines.push(`• ${escapeHtml(t.name)} (<code>${t.phone}</code>)`);
      }
    }
    if (b.cooling24to48h.length > 0) {
      lines.push('');
      lines.push('🟡 <b>Подостыл</b>:');
      for (const t of b.cooling24to48h) {
        lines.push(`• ${escapeHtml(t.name)} (<code>${t.phone}</code>) — ${t.lastSeenHr}ч назад`);
      }
    }
    if (b.activeLast24h.length > 0) {
      lines.push('');
      lines.push('🟢 <b>Активные сегодня</b>:');
      for (const t of b.activeLast24h) {
        lines.push(`• ${escapeHtml(t.name)} (<code>${t.phone}</code>) — ${t.lastSeenHr}ч назад`);
      }
    }
    return lines.join('\n');
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
