import { useQuery } from '@tanstack/react-query';
import { http } from '../api/http';
import { AdminApplication } from '../api/types';
import { StatusBadge } from '../components/status-badge';
import { formatDate } from '../lib/format';

export function ApplicationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'applications'],
    queryFn: async () => {
      const response = await http.get<AdminApplication[]>('/admin/applications');
      return response.data;
    },
  });

  return (
    <section className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Заявки</p>
          <h2>Лента обращений клиентов</h2>
        </div>
      </header>

      <div className="panel table-panel">
        {isLoading || !data ? (
          <p>Загружаем заявки...</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>СТО</th>
                <th>Проблема</th>
                <th>Дата</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {data.map((application) => (
                <tr key={application.id}>
                  <td>
                    {application.customerName}
                    <br />
                    <span className="muted">{application.customerPhone}</span>
                  </td>
                  <td>{application.workshop?.title ?? '—'}</td>
                  <td>{application.issueDescription}</td>
                  <td>{formatDate(application.createdAt)}</td>
                  <td>
                    <StatusBadge tone="neutral">{application.status}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
