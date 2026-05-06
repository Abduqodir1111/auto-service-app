import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { http } from '../api/http';

type TestersActivityResponse = {
  daysBack: number;
  /** Most-recent-first list of YYYY-MM-DD strings (one column per day). */
  days: string[];
  users: Array<{
    id: string;
    fullName: string;
    phone: string;
    role: 'CLIENT' | 'MASTER' | 'ADMIN';
    isBlocked: boolean;
    isVerifiedMaster: boolean;
    isTester?: boolean;
    createdAt: string;
    lastSeenAt: string | null;
    totalEvents: number;
    eventsByDay: Record<string, number>;
    eventsByName: Record<string, number>;
  }>;
};

type BulkMarkResult = {
  requested: number;
  updated: number;
  matchedPhones: string[];
  unmatchedPhones: string[];
  isTester: boolean;
};

const EVENT_LABELS: Record<string, string> = {
  app_opened: 'open',
  signup_started: 'signup→',
  signup_completed: 'signup✓',
  workshop_viewed: 'view',
  application_created: 'заявка',
};

function formatRelative(iso: string | null): string {
  if (!iso) return 'не открывал';
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}с назад`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const days = Math.floor(hr / 24);
  return `${days} дн назад`;
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

/**
 * Color-code a per-day cell. Empty = light gray, 1-3 = pale, 4-9 = medium,
 * 10+ = dark accent. Mirrors GitHub-style heat-maps.
 */
function heatStyle(count: number): React.CSSProperties {
  if (count === 0) return { background: '#F4F0E8', color: '#999' };
  if (count <= 3) return { background: '#FFE3D0', color: '#7A4A2A' };
  if (count <= 9) return { background: '#F4934A', color: '#FFFFFF' };
  return { background: '#C55B3C', color: '#FFFFFF', fontWeight: 700 };
}

export function TestersActivityPage() {
  const [daysBack, setDaysBack] = useState(7);
  const [showOnlyTesters, setShowOnlyTesters] = useState(false);
  const [bulkPhones, setBulkPhones] = useState('');
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin', 'testers-activity', daysBack],
    queryFn: async () => {
      const { data } = await http.get<TestersActivityResponse>(
        '/admin/analytics/testers',
        { params: { days: daysBack } },
      );
      return data;
    },
    refetchInterval: 30_000, // Auto-refresh every 30s — page is mostly read-only.
  });

  const markTesterMutation = useMutation({
    mutationFn: async ({ id, isTester }: { id: string; isTester: boolean }) => {
      await http.patch(`/admin/users/${id}/tester`, { isTester });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'testers-activity'] }),
  });

  const bulkMarkMutation = useMutation({
    mutationFn: async (phones: string[]) => {
      const { data } = await http.patch<BulkMarkResult>('/admin/testers/bulk-mark', {
        phones,
        isTester: true,
      });
      return data;
    },
    onSuccess: (data) => {
      const lines = [
        `Помечено как тестеры: ${data.updated} из ${data.requested}`,
      ];
      if (data.unmatchedPhones.length > 0) {
        lines.push(
          `\nНе найдены в БД (ещё не зарегистрировались?):\n${data.unmatchedPhones.join('\n')}`,
        );
      }
      alert(lines.join('\n'));
      setBulkPhones('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'testers-activity'] });
    },
  });

  const runReportMutation = useMutation({
    mutationFn: async () => {
      const { data } = await http.get<{ sent: boolean; testers: number }>(
        '/admin/testers/run-report',
      );
      return data;
    },
    onSuccess: (data) => {
      alert(
        data.sent
          ? `Отчёт отправлен в Telegram (${data.testers} тестеров)`
          : `Отчёт сформирован, но Telegram-отправка не удалась — проверь TELEGRAM_BOT_TOKEN на сервере (testers: ${data.testers})`,
      );
    },
  });

  if (query.isLoading) {
    return <p>Загружаем активность тестеров...</p>;
  }

  if (query.error || !query.data) {
    return <p className="error">Не удалось загрузить данные.</p>;
  }

  const { users: allUsers, days } = query.data;
  const visibleDays = days.slice(0, daysBack);
  const todayKey = days[0];

  const users = showOnlyTesters ? allUsers.filter((u) => u.isTester) : allUsers;
  const activeToday = users.filter((u) => (u.eventsByDay[todayKey] ?? 0) > 0).length;
  const inactiveCount = users.filter((u) => !u.lastSeenAt).length;
  const totalTesters = allUsers.filter((u) => u.isTester).length;

  return (
    <section className="stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Closed Testing</p>
          <h2>Активность тестеров</h2>
          <p className="muted">
            Кто из зарегистрированных пользователей реально открывал приложение и
            что делал. Обновляется каждые 30 секунд.
          </p>
        </div>
      </header>

      <div className="stat-row">
        <div className="panel panel--soft">
          <p className="eyebrow">Сегодня заходили</p>
          <strong style={{ fontSize: 28 }}>{activeToday}</strong>
          <span className="muted">из {users.length} в выборке</span>
        </div>
        <div className="panel panel--soft">
          <p className="eyebrow">Никогда не открывали</p>
          <strong style={{ fontSize: 28 }}>{inactiveCount}</strong>
          <span className="muted">регистрация без активности</span>
        </div>
        <div className="panel panel--soft">
          <p className="eyebrow">Помечены как тестеры</p>
          <strong style={{ fontSize: 28 }}>{totalTesters}</strong>
          <span className="muted">из {allUsers.length} зарегистрированных</span>
        </div>
      </div>

      <div className="panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <strong>Управление тестерами</strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className={`button${showOnlyTesters ? '' : ' button--ghost'}`}
              onClick={() => setShowOnlyTesters((v) => !v)}
              style={{ fontSize: 13 }}
            >
              {showOnlyTesters ? 'Показывать всех' : 'Только тестеры'}
            </button>
            <button
              className="button"
              onClick={() => runReportMutation.mutate()}
              disabled={runReportMutation.isPending}
              style={{ fontSize: 13 }}
            >
              {runReportMutation.isPending ? 'Отправляем...' : 'Отправить отчёт в Telegram сейчас'}
            </button>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Вставь номера тестеров (по одному в строке, формат <code>+998901234567</code>),
          нажми «Пометить» — пользователи с этими телефонами получат флаг «тестер»
          и попадут в ежедневный Telegram-отчёт в 09:00 (Ташкент).
        </p>
        <textarea
          value={bulkPhones}
          onChange={(e) => setBulkPhones(e.target.value)}
          placeholder="+998901234567&#10;+998991234567&#10;..."
          rows={5}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 12,
            border: '1px solid var(--border)',
            fontFamily: 'monospace',
            fontSize: 13,
            marginTop: 8,
          }}
        />
        <button
          className="button"
          style={{ marginTop: 8, fontSize: 13 }}
          disabled={bulkMarkMutation.isPending || !bulkPhones.trim()}
          onClick={() => {
            const phones = bulkPhones
              .split(/[\n,;]/)
              .map((p) => p.trim())
              .filter(Boolean);
            if (phones.length === 0) return;
            bulkMarkMutation.mutate(phones);
          }}
        >
          {bulkMarkMutation.isPending ? 'Помечаем...' : 'Пометить как тестеров'}
        </button>
      </div>

      <div className="panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <strong>Активность по дням</strong>
          <div style={{ display: 'flex', gap: 6 }}>
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDaysBack(d)}
                className={`button${daysBack === d ? '' : ' button--ghost'}`}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                {d} дн
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Пользователь</th>
                <th style={{ textAlign: 'center' }}>Тестер</th>
                <th>Роль</th>
                <th>Регистрация</th>
                <th>Был последний раз</th>
                <th style={{ textAlign: 'right' }}>Всего</th>
                {visibleDays.map((d) => (
                  <th key={d} style={{ textAlign: 'center', minWidth: 56, fontSize: 11 }}>
                    {formatDayLabel(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const breakdown = Object.entries(user.eventsByName)
                  .sort((a, b) => b[1] - a[1]);
                return (
                  <tr key={user.id}>
                    <td>
                      <div>
                        <strong>{user.fullName}</strong>
                        {user.isBlocked ? (
                          <span className="badge badge--danger" style={{ marginLeft: 6 }}>
                            заблокирован
                          </span>
                        ) : null}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {user.phone}
                      </div>
                      {breakdown.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                          {breakdown.map(([name, count]) => (
                            <span
                              key={name}
                              className="badge"
                              style={{ fontSize: 10 }}
                              title={name}
                            >
                              {EVENT_LABELS[name] ?? name} · {count}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(user.isTester)}
                        disabled={markTesterMutation.isPending}
                        onChange={(e) =>
                          markTesterMutation.mutate({
                            id: user.id,
                            isTester: e.target.checked,
                          })
                        }
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <span className="badge">{user.role}</span>
                      {user.isVerifiedMaster ? (
                        <span className="badge badge--success" style={{ marginLeft: 4 }}>
                          ✓
                        </span>
                      ) : null}
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <span className={user.lastSeenAt ? '' : 'muted'}>
                        {formatRelative(user.lastSeenAt)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {user.totalEvents}
                    </td>
                    {visibleDays.map((d) => {
                      const cnt = user.eventsByDay[d] ?? 0;
                      return (
                        <td
                          key={d}
                          style={{
                            textAlign: 'center',
                            padding: 4,
                          }}
                        >
                          <div
                            style={{
                              ...heatStyle(cnt),
                              padding: '6px 0',
                              borderRadius: 6,
                              fontSize: 13,
                            }}
                          >
                            {cnt || ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
          <span className="muted">Цвет ячейки:</span>
          <span style={{ padding: '2px 10px', borderRadius: 4, ...heatStyle(0) }}>0</span>
          <span style={{ padding: '2px 10px', borderRadius: 4, ...heatStyle(1) }}>1-3</span>
          <span style={{ padding: '2px 10px', borderRadius: 4, ...heatStyle(5) }}>4-9</span>
          <span style={{ padding: '2px 10px', borderRadius: 4, ...heatStyle(10) }}>10+</span>
        </div>
      </div>
    </section>
  );
}
