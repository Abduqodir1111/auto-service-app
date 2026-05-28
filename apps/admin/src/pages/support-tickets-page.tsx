import { SupportTicketStatus, SupportTicketType } from '@stomvp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { http } from '../api/http';
import { AdminSupportTicket } from '../api/types';
import { StatusBadge } from '../components/status-badge';
import { formatDate } from '../lib/format';

const typeLabels: Record<SupportTicketType, string> = {
  [SupportTicketType.SUGGESTION]: 'Предложение',
  [SupportTicketType.COMPLAINT]: 'Жалоба',
};

function getTicketTone(status: SupportTicketStatus) {
  if (status === SupportTicketStatus.RESOLVED) {
    return 'success' as const;
  }

  if (status === SupportTicketStatus.REJECTED) {
    return 'neutral' as const;
  }

  return 'warning' as const;
}

export function SupportTicketsPage() {
  const queryClient = useQueryClient();
  const [resolution, setResolution] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'support-tickets'],
    queryFn: async () => {
      const response = await http.get<AdminSupportTicket[]>('/admin/support-tickets');
      return response.data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (payload: {
      id: string;
      status: SupportTicketStatus;
      resolution?: string;
    }) => {
      await http.patch(`/admin/support-tickets/${payload.id}/status`, {
        status: payload.status,
        resolution: payload.resolution,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'support-tickets'] });
    },
  });

  const mutationError =
    updateStatus.isError && axios.isAxiosError(updateStatus.error)
      ? typeof updateStatus.error.response?.data?.message === 'string'
        ? updateStatus.error.response?.data?.message
        : 'Не удалось обновить обращение.'
      : null;

  return (
    <section className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Обратная связь</p>
          <h2>Поддержка</h2>
          <p className="muted">
            Предложения и жалобы, которые пользователи отправляют из приложения.
          </p>
        </div>
      </header>

      <div className="stack">
        {mutationError ? <div className="alert">{mutationError}</div> : null}
        {isLoading || !data ? (
          <div className="panel">Загружаем обращения...</div>
        ) : data.length === 0 ? (
          <div className="panel">Обращений пока нет.</div>
        ) : (
          data.map((ticket) => (
            <article className="panel report-card" key={ticket.id}>
              <div className="workshop-card__top">
                <div>
                  <p className="eyebrow">{typeLabels[ticket.type]}</p>
                  <h3>{ticket.user?.fullName ?? 'Пользователь удалён'}</h3>
                  <p className="muted">
                    {ticket.user?.phone ?? ticket.contactPhone ?? 'телефон не указан'} •{' '}
                    {formatDate(ticket.createdAt)}
                  </p>
                </div>
                <StatusBadge tone={getTicketTone(ticket.status)}>{ticket.status}</StatusBadge>
              </div>

              <div className="report-card__body">
                <div className="inline-note">
                  <strong>Сообщение:</strong> {ticket.message}
                </div>
                {ticket.resolution ? (
                  <div className="inline-note inline-note--success">
                    <strong>Решение:</strong> {ticket.resolution}
                  </div>
                ) : null}
              </div>

              <label className="field">
                <span>Комментарий администратора</span>
                <input
                  value={resolution[ticket.id] ?? ''}
                  placeholder="Например: связались с пользователем или передали в разработку"
                  onChange={(event) =>
                    setResolution((current) => ({
                      ...current,
                      [ticket.id]: event.target.value,
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
                      id: ticket.id,
                      status: SupportTicketStatus.IN_REVIEW,
                      resolution: resolution[ticket.id],
                    })
                  }
                >
                  В работу
                </button>
                <button
                  className="button"
                  disabled={updateStatus.isPending}
                  onClick={() =>
                    updateStatus.mutate({
                      id: ticket.id,
                      status: SupportTicketStatus.RESOLVED,
                      resolution: resolution[ticket.id] || 'Обращение обработано.',
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
                      id: ticket.id,
                      status: SupportTicketStatus.REJECTED,
                      resolution: resolution[ticket.id] || 'Обращение закрыто без действий.',
                    })
                  }
                >
                  Закрыть
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
