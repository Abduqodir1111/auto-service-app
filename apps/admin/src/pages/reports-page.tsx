import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ReportStatus, ReportTargetType } from '@stomvp/shared';
import { useState } from 'react';
import { http } from '../api/http';
import { AdminReport } from '../api/types';
import { StatusBadge } from '../components/status-badge';
import { formatDate } from '../lib/format';

const reportTargetLabels: Record<ReportTargetType, string> = {
  [ReportTargetType.WORKSHOP]: 'Объявление',
  [ReportTargetType.PHOTO]: 'Фото',
  [ReportTargetType.REVIEW]: 'Отзыв',
  [ReportTargetType.SERVICE_CALL]: 'Срочный вызов',
};

function getReportTone(status: ReportStatus) {
  if (status === ReportStatus.RESOLVED) {
    return 'success' as const;
  }

  if (status === ReportStatus.REJECTED) {
    return 'neutral' as const;
  }

  return 'warning' as const;
}

export function ReportsPage() {
  const queryClient = useQueryClient();
  const [resolution, setResolution] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: async () => {
      const response = await http.get<AdminReport[]>('/admin/reports');
      return response.data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (payload: { id: string; status: ReportStatus; resolution?: string }) => {
      await http.patch(`/admin/reports/${payload.id}/status`, {
        status: payload.status,
        resolution: payload.resolution,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'moderation-history'] }),
      ]);
    },
  });

  const mutationError =
    updateStatus.isError && axios.isAxiosError(updateStatus.error)
      ? typeof updateStatus.error.response?.data?.message === 'string'
        ? updateStatus.error.response?.data?.message
        : 'Не удалось обновить жалобу.'
      : null;

  return (
    <section className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Доверие</p>
          <h2>Жалобы пользователей</h2>
          <p className="muted">
            Сигналы по объявлениям, фото и отзывам. Решённые жалобы остаются в истории.
          </p>
        </div>
      </header>

      <div className="stack">
        {mutationError ? <div className="alert">{mutationError}</div> : null}
        {isLoading || !data ? (
          <div className="panel">Загружаем жалобы...</div>
        ) : data.length === 0 ? (
          <div className="panel">Жалоб пока нет.</div>
        ) : (
          data.map((report) => (
            <article className="panel report-card" key={report.id}>
              <div className="workshop-card__top">
                <div>
                  <p className="eyebrow">{reportTargetLabels[report.targetType]}</p>
                  <h3>{report.target?.title ?? 'Объект не найден'}</h3>
                  <p className="muted">
                    Жалоба от {report.reporter?.fullName ?? 'удалённого пользователя'} •{' '}
                    {formatDate(report.createdAt)}
                  </p>
                </div>
                <StatusBadge tone={getReportTone(report.status)}>{report.status}</StatusBadge>
              </div>

              <div className="report-card__body">
                <div className="inline-note">
                  <strong>Причина:</strong> {report.reason}
                </div>
                {report.comment ? (
                  <div className="inline-note">
                    <strong>Комментарий:</strong> {report.comment}
                  </div>
                ) : null}
                {report.target?.comment ? (
                  <div className="inline-note">
                    <strong>Текст отзыва:</strong> {report.target.comment}
                  </div>
                ) : null}
                {report.resolution ? (
                  <div className="inline-note inline-note--success">
                    <strong>Решение:</strong> {report.resolution}
                  </div>
                ) : null}
              </div>

              <label className="field">
                <span>Решение модератора</span>
                <input
                  value={resolution[report.id] ?? ''}
                  placeholder="Например: фото скрыто, отзыв отклонён или нарушения не найдено"
                  onChange={(event) =>
                    setResolution((current) => ({
                      ...current,
                      [report.id]: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="actions">
                <button
                  className="button button--ghost"
                  disabled={updateStatus.isPending}
                  onClick={() =>
                    updateStatus.mutate({
                      id: report.id,
                      status: ReportStatus.IN_REVIEW,
                      resolution: resolution[report.id],
                    })
                  }
                >
                  Взять в работу
                </button>
                <button
                  className="button"
                  disabled={updateStatus.isPending}
                  onClick={() =>
                    updateStatus.mutate({
                      id: report.id,
                      status: ReportStatus.RESOLVED,
                      resolution: resolution[report.id] || 'Жалоба обработана модератором.',
                    })
                  }
                >
                  Решено
                </button>
                <button
                  className="button button--ghost"
                  disabled={updateStatus.isPending}
                  onClick={() =>
                    updateStatus.mutate({
                      id: report.id,
                      status: ReportStatus.REJECTED,
                      resolution: resolution[report.id] || 'Нарушений не найдено.',
                    })
                  }
                >
                  Нарушений нет
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
