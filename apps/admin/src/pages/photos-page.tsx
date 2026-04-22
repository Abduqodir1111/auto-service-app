import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { PhotoStatus } from '@stomvp/shared';
import { http } from '../api/http';
import { AdminPhoto } from '../api/types';
import { formatDate } from '../lib/format';

export function PhotosPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'photos'],
    queryFn: async () => {
      const response = await http.get<AdminPhoto[]>('/admin/photos');
      return response.data;
    },
  });

  const moderate = useMutation({
    mutationFn: async (payload: { id: string; status: PhotoStatus }) => {
      const response = await http.patch<AdminPhoto>(`/admin/photos/${payload.id}/moderate`, {
        status: payload.status,
      });
      return response.data;
    },
    onSuccess: (photo) => {
      queryClient.setQueryData<AdminPhoto[]>(['admin', 'photos'], (current) =>
        (current ?? []).filter((item) => item.id !== photo.id),
      );
      void queryClient.invalidateQueries({ queryKey: ['admin', 'photos'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] });
    },
  });

  const mutationError =
    moderate.isError && axios.isAxiosError(moderate.error)
      ? typeof moderate.error.response?.data?.message === 'string'
        ? moderate.error.response?.data?.message
        : Array.isArray(moderate.error.response?.data?.message)
          ? moderate.error.response?.data?.message.join(', ')
          : 'Не удалось изменить статус фото.'
      : null;

  return (
    <section className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Фото</p>
          <h2>Модерация загруженных изображений</h2>
          <p className="muted">
            Обычно фото теперь одобряются вместе с карточкой СТО. Эта вкладка нужна для ручной
            проверки отдельных изображений.
          </p>
        </div>
      </header>

      <div className="photo-grid">
        {mutationError ? <div className="alert">{mutationError}</div> : null}
        {isLoading || !data ? (
          <div className="panel">Загружаем фото...</div>
        ) : data.length === 0 ? (
          <div className="panel">
            Сейчас нет фотографий на модерации.
            <br />
            Все загруженные фото уже одобрены или отклонены.
          </div>
        ) : (
          data.map((photo) => (
            <article className="panel photo-card" key={photo.id}>
              <img alt={photo.workshop.title} className="photo-card__image" src={photo.url} />
              <div className="photo-card__content">
                <strong>{photo.workshop.title}</strong>
                <span className="muted">{photo.uploader.fullName}</span>
                <span className="muted">{formatDate(photo.createdAt)}</span>
              </div>
              <div className="actions">
                <button
                  className="button"
                  disabled={moderate.isPending}
                  onClick={() => {
                    moderate.reset();
                    moderate.mutate({ id: photo.id, status: PhotoStatus.APPROVED });
                  }}
                >
                  Одобрить
                </button>
                <button
                  className="button button--ghost"
                  disabled={moderate.isPending}
                  onClick={() => {
                    moderate.reset();
                    moderate.mutate({ id: photo.id, status: PhotoStatus.REJECTED });
                  }}
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
