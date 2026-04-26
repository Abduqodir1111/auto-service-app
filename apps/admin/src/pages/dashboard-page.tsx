import { useQuery } from '@tanstack/react-query';
import { http } from '../api/http';
import { AdminAnalytics } from '../api/types';
import { StatCard } from '../components/stat-card';

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: async () => {
      const response = await http.get<AdminAnalytics>('/admin/analytics');
      return response.data;
    },
  });

  return (
    <section className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Сводка</p>
          <h2>Операционная картина MVP</h2>
        </div>
      </header>

      {isLoading || !data ? (
        <div className="panel">Загружаем метрики...</div>
      ) : (
        <div className="stats-grid">
          <StatCard label="Пользователи" value={data.totalUsers} hint="Всего аккаунтов" />
          <StatCard label="Мастера" value={data.totalMasters} hint="Активные владельцы СТО" />
          <StatCard
            label="Мастерские"
            value={data.totalWorkshops}
            hint="Всего карточек в системе"
          />
          <StatCard
            label="На модерации"
            value={data.pendingWorkshops}
            hint="Новые или обновлённые СТО"
          />
          <StatCard
            label="Отзывы"
            value={data.pendingReviews}
            hint="Ждут подтверждения"
          />
          <StatCard label="Фото" value={data.pendingPhotos} hint="На ручной проверке" />
          <StatCard label="Жалобы" value={data.pendingReports} hint="Новые сигналы доверия" />
          <StatCard
            label="Заявки"
            value={data.totalApplications}
            hint="Клиентские обращения"
          />
        </div>
      )}
    </section>
  );
}
