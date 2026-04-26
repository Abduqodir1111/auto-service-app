import { useQuery } from '@tanstack/react-query';
import { ModerationAction, ModerationEntityType } from '@stomvp/shared';
import { http } from '../api/http';
import { AdminModerationLog } from '../api/types';
import { StatusBadge } from '../components/status-badge';
import { formatDate } from '../lib/format';

const entityLabels: Record<ModerationEntityType, string> = {
  [ModerationEntityType.USER]: 'Пользователь',
  [ModerationEntityType.WORKSHOP]: 'Объявление',
  [ModerationEntityType.PHOTO]: 'Фото',
  [ModerationEntityType.REVIEW]: 'Отзыв',
  [ModerationEntityType.REPORT]: 'Жалоба',
};

function getActionTone(action: ModerationAction) {
  if (action === ModerationAction.APPROVED || action === ModerationAction.VERIFIED) {
    return 'success' as const;
  }

  if (
    action === ModerationAction.REJECTED ||
    action === ModerationAction.BLOCKED ||
    action === ModerationAction.DELETED
  ) {
    return 'danger' as const;
  }

  if (action === ModerationAction.RESOLVED) {
    return 'warning' as const;
  }

  return 'neutral' as const;
}

export function ModerationHistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'moderation-history'],
    queryFn: async () => {
      const response = await http.get<AdminModerationLog[]>('/admin/moderation-history');
      return response.data;
    },
  });

  return (
    <section className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Аудит</p>
          <h2>История модерации</h2>
          <p className="muted">
            Последние действия администраторов по пользователям, объявлениям, фото, отзывам и
            жалобам.
          </p>
        </div>
      </header>

      <div className="panel table-panel">
        {isLoading || !data ? (
          <p>Загружаем историю...</p>
        ) : data.length === 0 ? (
          <p>История пока пустая.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Модератор</th>
                <th>Объект</th>
                <th>Действие</th>
                <th>Изменение</th>
                <th>Примечание</th>
              </tr>
            </thead>
            <tbody>
              {data.map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.createdAt)}</td>
                  <td>
                    {log.actor ? (
                      <>
                        <strong>{log.actor.fullName}</strong>
                        <br />
                        <span className="muted">{log.actor.phone}</span>
                      </>
                    ) : (
                      <span className="muted">Система / удалённый админ</span>
                    )}
                  </td>
                  <td>
                    <strong>{entityLabels[log.entityType]}</strong>
                    <br />
                    <span className="muted">{log.entityId}</span>
                  </td>
                  <td>
                    <StatusBadge tone={getActionTone(log.action)}>{log.action}</StatusBadge>
                  </td>
                  <td>
                    <span className="muted">{log.fromStatus ?? '—'}</span>
                    {' → '}
                    <strong>{log.toStatus ?? '—'}</strong>
                  </td>
                  <td>{log.note ?? <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
