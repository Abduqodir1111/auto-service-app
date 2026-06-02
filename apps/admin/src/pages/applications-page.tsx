import { ApplicationStatus } from '@stomvp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { http } from '../api/http';
import { AdminApplication } from '../api/types';
import { StatusBadge } from '../components/status-badge';
import { formatDate } from '../lib/format';

const statusTone: Record<ApplicationStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  [ApplicationStatus.NEW]: 'warning',
  [ApplicationStatus.IN_PROGRESS]: 'neutral',
  [ApplicationStatus.COMPLETED]: 'success',
  [ApplicationStatus.CANCELLED]: 'danger',
};

const statusFilters: Array<{ label: string; value: ApplicationStatus | 'ALL' | 'ATTENTION' }> = [
  { label: 'Требует внимания', value: 'ATTENTION' },
  { label: 'Все', value: 'ALL' },
  { label: 'Новые', value: ApplicationStatus.NEW },
  { label: 'В работе', value: ApplicationStatus.IN_PROGRESS },
  { label: 'Завершённые', value: ApplicationStatus.COMPLETED },
  { label: 'Отменённые', value: ApplicationStatus.CANCELLED },
];

function matchesSearch(application: AdminApplication, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return [
    application.customerName,
    application.customerPhone,
    application.carModel,
    application.issueDescription,
    application.workshop?.title,
    application.workshop?.phone,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

export function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'ALL' | 'ATTENTION'>(
    'ATTENTION',
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'applications'],
    queryFn: async () => {
      const response = await http.get<AdminApplication[]>('/admin/applications');
      return response.data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (payload: { ids: string[]; status: ApplicationStatus }) => {
      await Promise.all(
        payload.ids.map((id) => http.patch(`/applications/${id}/status`, { status: payload.status })),
      );
    },
    onSuccess: async () => {
      setSelectedIds([]);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] });
    },
  });

  const filteredApplications = useMemo(() => {
    const items = data ?? [];
    return items.filter((application) => {
      const statusMatches =
        statusFilter === 'ALL' ||
        (statusFilter === 'ATTENTION'
          ? application.status === ApplicationStatus.NEW ||
            application.status === ApplicationStatus.IN_PROGRESS
          : application.status === statusFilter);

      return statusMatches && matchesSearch(application, search);
    });
  }, [data, search, statusFilter]);

  const selectedCount = selectedIds.length;
  const allVisibleSelected =
    filteredApplications.length > 0 &&
    filteredApplications.every((application) => selectedIds.includes(application.id));

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !filteredApplications.some((application) => application.id === id)),
      );
      return;
    }

    setSelectedIds((current) => [
      ...current,
      ...filteredApplications
        .map((application) => application.id)
        .filter((id) => !current.includes(id)),
    ]);
  };

  const toggleOne = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return (
    <section className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Заявки</p>
          <h2>Лента обращений клиентов</h2>
        </div>
      </header>

      <div className="panel admin-toolbar">
        <label className="field admin-search">
          <span>Поиск</span>
          <input
            value={search}
            placeholder="Имя, телефон, СТО, проблема или автомобиль"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="admin-filter-tabs" aria-label="Фильтр заявок">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              className={`admin-filter-tab${statusFilter === filter.value ? ' is-active' : ''}`}
              type="button"
              onClick={() => {
                setStatusFilter(filter.value);
                setSelectedIds([]);
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {selectedCount ? (
        <div className="panel bulk-bar">
          <strong>Выбрано: {selectedCount}</strong>
          <div className="actions">
            <button
              className="button button--ghost"
              disabled={updateStatus.isPending}
              onClick={() =>
                updateStatus.mutate({ ids: selectedIds, status: ApplicationStatus.IN_PROGRESS })
              }
            >
              В работу
            </button>
            <button
              className="button"
              disabled={updateStatus.isPending}
              onClick={() =>
                updateStatus.mutate({ ids: selectedIds, status: ApplicationStatus.COMPLETED })
              }
            >
              Завершить
            </button>
            <button
              className="button button--ghost"
              disabled={updateStatus.isPending}
              onClick={() => setSelectedIds([])}
            >
              Снять выбор
            </button>
          </div>
        </div>
      ) : null}

      <div className="panel table-panel">
        {isLoading || !data ? (
          <p>Загружаем заявки...</p>
        ) : filteredApplications.length === 0 ? (
          <p className="muted">По выбранным фильтрам заявок нет.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>
                  <input
                    aria-label="Выбрать все видимые заявки"
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                  />
                </th>
                <th>Клиент</th>
                <th>СТО</th>
                <th>Проблема</th>
                <th>Дата</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map((application) => (
                <tr key={application.id}>
                  <td>
                    <input
                      aria-label={`Выбрать заявку ${application.customerName}`}
                      type="checkbox"
                      checked={selectedIds.includes(application.id)}
                      onChange={() => toggleOne(application.id)}
                    />
                  </td>
                  <td>
                    {application.customerName}
                    <br />
                    <span className="muted">{application.customerPhone}</span>
                    {application.carModel ? (
                      <>
                        <br />
                        <span className="muted">{application.carModel}</span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {application.workshop?.title ?? '—'}
                    {application.workshop?.phone ? (
                      <>
                        <br />
                        <span className="muted">{application.workshop.phone}</span>
                      </>
                    ) : null}
                  </td>
                  <td>{application.issueDescription}</td>
                  <td>{formatDate(application.createdAt)}</td>
                  <td>
                    <StatusBadge tone={statusTone[application.status]}>
                      {application.status}
                    </StatusBadge>
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
