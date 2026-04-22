import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ReviewStatus } from '@stomvp/shared';
import { http } from '../api/http';
import { AdminReview } from '../api/types';
import { StatusBadge } from '../components/status-badge';
import { formatDate } from '../lib/format';

export function ReviewsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reviews'],
    queryFn: async () => {
      const response = await http.get<AdminReview[]>('/admin/reviews');
      return response.data;
    },
  });

  const moderate = useMutation({
    mutationFn: async (payload: { id: string; status: ReviewStatus }) => {
      await http.patch(`/admin/reviews/${payload.id}/moderate`, {
        status: payload.status,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] }),
      ]);
    },
  });

  const mutationError =
    moderate.isError && axios.isAxiosError(moderate.error)
      ? typeof moderate.error.response?.data?.message === 'string'
        ? moderate.error.response?.data?.message
        : 'Не удалось изменить статус отзыва.'
      : null;

  return (
    <section className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Отзывы</p>
          <h2>Модерация клиентских комментариев</h2>
        </div>
      </header>

      <div className="stack">
        {mutationError ? <div className="alert">{mutationError}</div> : null}
        {isLoading || !data ? (
          <div className="panel">Загружаем отзывы...</div>
        ) : (
          data.map((review) => (
            <article className="panel review-card" key={review.id}>
              <div className="review-card__head">
                <div>
                  <strong>{review.author.fullName}</strong>
                  <p className="muted">{review.workshop.title}</p>
                </div>
                <StatusBadge tone="warning">{review.status}</StatusBadge>
              </div>

              <p>{review.comment}</p>
              <p className="muted">
                Оценка: {review.rating}/5 • {formatDate(review.createdAt)}
              </p>

              <div className="actions">
                <button
                  className="button"
                  disabled={moderate.isPending}
                  onClick={() =>
                    moderate.mutate({ id: review.id, status: ReviewStatus.PUBLISHED })
                  }
                >
                  Опубликовать
                </button>
                <button
                  className="button button--ghost"
                  disabled={moderate.isPending}
                  onClick={() =>
                    moderate.mutate({ id: review.id, status: ReviewStatus.REJECTED })
                  }
                >
                  Отклонить
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
