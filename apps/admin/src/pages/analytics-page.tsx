import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { http } from '../api/http';
import { AdminEventsAnalytics, AdminEventName } from '../api/types';
import { StatCard } from '../components/stat-card';

const EVENT_LABELS: Record<string, string> = {
  app_opened: 'Открыли приложение',
  signup_started: 'Начали регистрацию',
  signup_completed: 'Завершили регистрацию',
  workshop_viewed: 'Просмотр мастерской',
  application_created: 'Создали заявку',
};

const EVENT_BADGE: Record<string, { label: string; tone: string }> = {
  app_opened: { label: 'open', tone: 'badge--neutral' },
  signup_started: { label: 'signup→', tone: 'badge--warning' },
  signup_completed: { label: 'signup✓', tone: 'badge--success' },
  workshop_viewed: { label: 'view', tone: 'badge--accent' },
  application_created: { label: 'заявка', tone: 'badge--success' },
};

function formatRelativeTime(iso: string): string {
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

function eventLabel(name: AdminEventName): string {
  return EVENT_LABELS[name] ?? name;
}

function FunnelView({
  funnel,
}: {
  funnel: AdminEventsAnalytics['funnel'];
}) {
  const max = Math.max(...funnel.map((f) => f.count), 1);
  const first = funnel[0]?.count ?? 0;

  return (
    <div className="funnel">
      {funnel.map((step, i) => {
        const widthPct = (step.count / max) * 100;
        const fromPrev = i > 0 ? funnel[i - 1].count : 0;
        const dropPct =
          i > 0 && fromPrev > 0
            ? Math.round(((fromPrev - step.count) / fromPrev) * 100)
            : null;
        const ofFirstPct =
          first > 0 ? Math.round((step.count / first) * 100) : null;

        return (
          <div key={step.event} className="funnel__row">
            <div className="funnel__label">
              <span className="funnel__name">{eventLabel(step.event)}</span>
              <span className="funnel__num">
                <strong>{step.count}</strong>
                {ofFirstPct !== null && i > 0 && (
                  <span className="muted"> ({ofFirstPct}%)</span>
                )}
              </span>
            </div>
            <div className="funnel__bar-track">
              <div
                className="funnel__bar"
                style={{ width: `${widthPct}%` }}
              />
            </div>
            {dropPct !== null && dropPct > 0 && (
              <div className="funnel__drop">
                ↓ потеряно {dropPct}% относительно предыдущего шага
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AnalyticsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'analytics', 'events'],
    queryFn: async () => {
      const response = await http.get<AdminEventsAnalytics>(
        '/admin/analytics/events',
      );
      return response.data;
    },
    refetchInterval: 30_000, // live-ish: refetch every 30s
  });

  return (
    <section className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Тестеры</p>
          <h2>Аналитика приложения</h2>
          <p className="muted">
            События с мобильных устройств и админки. Обновляется каждые 30 секунд.
          </p>
        </div>
        <button className="button button--ghost" onClick={() => refetch()}>
          Обновить сейчас
        </button>
      </header>

      {isError && (
        <div className="alert">
          Не удалось загрузить аналитику. Попробуйте обновить страницу.
        </div>
      )}

      {isLoading || !data ? (
        <div className="panel">Загружаем метрики...</div>
      ) : (
        <>
          {/* Big numbers */}
          <div className="stats-grid">
            <StatCard
              label="Всего пользователей"
              value={data.totals.totalUsers}
              hint="Зарегистрированных аккаунтов"
            />
            <StatCard
              label="Активны 24 часа"
              value={data.totals.active24h}
              hint="Открывали приложение за сутки"
            />
            <StatCard
              label="Активны 7 дней"
              value={data.totals.active7d}
              hint="Открывали приложение за неделю"
            />
            <StatCard
              label="Создано заявок"
              value={data.totals.totalApplications}
              hint="Всего обращений к мастерам"
            />
            <StatCard
              label="Всего событий"
              value={data.totals.totalEvents}
              hint="Все аналитические события"
            />
          </div>

          {/* Funnel */}
          <article className="panel analytics-section">
            <header className="analytics-section__header">
              <p className="eyebrow">Воронка</p>
              <h3>Путь пользователя за последние 7 дней</h3>
              <p className="muted">
                Где именно теряем тестеров. Чем больше «↓ потеряно %» — тем
                критичнее это место в продукте.
              </p>
            </header>
            <FunnelView funnel={data.funnel} />
          </article>

          {/* Activity by day */}
          <article className="panel analytics-section">
            <header className="analytics-section__header">
              <p className="eyebrow">Активность</p>
              <h3>Открытия приложения по дням</h3>
              <p className="muted">
                Сколько раз открывали приложение каждый день за последние 30 дней.
              </p>
            </header>
            <div className="chart-wrapper">
              {data.activityByDay.length === 0 ? (
                <div className="muted">Пока нет данных за 30 дней.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart
                    data={data.activityByDay.map((d) => ({
                      ...d,
                      dayLabel: formatDayLabel(d.day),
                    }))}
                    margin={{ top: 10, right: 20, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(23,33,32,0.08)"
                    />
                    <XAxis
                      dataKey="dayLabel"
                      stroke="#60716d"
                      fontSize={12}
                      tickMargin={8}
                    />
                    <YAxis
                      allowDecimals={false}
                      stroke="#60716d"
                      fontSize={12}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(255,252,247,0.95)',
                        border: '1px solid rgba(23,33,32,0.12)',
                        borderRadius: 12,
                      }}
                      labelStyle={{ color: '#172120', fontWeight: 600 }}
                      formatter={(v: unknown) => [String(v), 'Открытий']}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#d66c2f"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#d66c2f' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>

          {/* Top workshops */}
          <article className="panel analytics-section">
            <header className="analytics-section__header">
              <p className="eyebrow">Топ-10</p>
              <h3>Самые просматриваемые мастерские</h3>
              <p className="muted">
                Какие СТО пользователи открывают чаще всего — сюда стоит
                направлять рекламу.
              </p>
            </header>
            <div className="chart-wrapper">
              {data.topWorkshops.length === 0 ? (
                <div className="muted">Пока никто не смотрел мастерские.</div>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(200, data.topWorkshops.length * 36)}
                >
                  <BarChart
                    data={data.topWorkshops}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(23,33,32,0.08)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      stroke="#60716d"
                      fontSize={12}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="title"
                      stroke="#60716d"
                      fontSize={12}
                      width={140}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(255,252,247,0.95)',
                        border: '1px solid rgba(23,33,32,0.12)',
                        borderRadius: 12,
                      }}
                      formatter={(v: unknown) => [String(v), 'Просмотров']}
                    />
                    <Bar
                      dataKey="views"
                      fill="#d66c2f"
                      radius={[0, 8, 8, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>

          {/* Recent events */}
          <article className="panel analytics-section">
            <header className="analytics-section__header">
              <p className="eyebrow">Лента</p>
              <h3>Последние 50 событий</h3>
              <p className="muted">
                Что прямо сейчас делают пользователи в приложении.
              </p>
            </header>
            {data.recentEvents.length === 0 ? (
              <div className="muted">Пока нет событий.</div>
            ) : (
              <div className="events-list">
                {data.recentEvents.map((ev) => {
                  const badge = EVENT_BADGE[ev.name] ?? {
                    label: ev.name,
                    tone: 'badge--neutral',
                  };
                  return (
                    <div key={ev.id} className="event-row">
                      <span className={`event-badge ${badge.tone}`}>
                        {badge.label}
                      </span>
                      <div className="event-row__main">
                        <strong>{eventLabel(ev.name)}</strong>
                        <div className="event-row__meta">
                          {ev.userName ? (
                            <span>
                              👤 {ev.userName}
                              {ev.userPhone ? ` · ${ev.userPhone}` : ''}
                            </span>
                          ) : (
                            <span className="muted">👤 анонимно</span>
                          )}
                          {ev.properties && Object.keys(ev.properties).length > 0 && (
                            <span className="muted event-row__props">
                              · {JSON.stringify(ev.properties)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="event-row__time">
                        <span>{formatRelativeTime(ev.createdAt)}</span>
                        {ev.ip && (
                          <span className="muted event-row__ip">{ev.ip}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </>
      )}
    </section>
  );
}
