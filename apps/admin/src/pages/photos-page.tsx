import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { PhotoStatus } from '@stomvp/shared';
import { http } from '../api/http';
import { AdminPhoto } from '../api/types';
import { formatDate } from '../lib/format';

const photoStatusLabels: Record<PhotoStatus, string> = {
  [PhotoStatus.PENDING]: 'На проверке',
  [PhotoStatus.APPROVED]: 'Одобрено',
  [PhotoStatus.REJECTED]: 'Отклонено',
};

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

  const setPrimary = useMutation({
    mutationFn: async (id: string) => {
      const response = await http.patch<AdminPhoto>(`/uploads/photos/${id}/primary`);
      return response.data;
    },
    onSuccess: (photo) => {
      queryClient.setQueryData<AdminPhoto[]>(['admin', 'photos'], (current) =>
        (current ?? []).map((item) =>
          item.workshop.id === photo.workshop.id
            ? {
                ...item,
                isPrimary: item.id === photo.id,
              }
            : item,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: ['admin', 'workshops'] });
    },
  });

  const deletePhoto = useMutation({
    mutationFn: async (id: string) => {
      await http.delete(`/uploads/photos/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<AdminPhoto[]>(['admin', 'photos'], (current) =>
        (current ?? []).filter((item) => item.id !== id),
      );
      void queryClient.invalidateQueries({ queryKey: ['admin', 'photos'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'workshops'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] });
    },
  });

  const mutationError =
    [moderate.error, setPrimary.error, deletePhoto.error].find((error) => axios.isAxiosError(error));

  const mutationErrorText =
    mutationError && axios.isAxiosError(mutationError)
      ? typeof mutationError.response?.data?.message === 'string'
        ? mutationError.response?.data?.message
        : Array.isArray(mutationError.response?.data?.message)
          ? mutationError.response?.data?.message.join(', ')
          : 'Не удалось изменить фото.'
      : null;

  const isActionPending = moderate.isPending || setPrimary.isPending || deletePhoto.isPending;

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
        {mutationErrorText ? <div className="alert">{mutationErrorText}</div> : null}
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
                <span className="chip">
                  {photoStatusLabels[photo.status]}
                  {photo.isPrimary ? ' • Главное' : ''}
                </span>
              </div>
              <div className="actions">
                <button
                  className="button"
                  disabled={isActionPending}
                  onClick={() => {
                    moderate.reset();
                    moderate.mutate({ id: photo.id, status: PhotoStatus.APPROVED });
                  }}
                >
                  Одобрить
                </button>
                <button
                  className="button button--ghost"
                  disabled={isActionPending}
                  onClick={() => {
                    moderate.reset();
                    moderate.mutate({ id: photo.id, status: PhotoStatus.REJECTED });
                  }}
                >
                  Отклонить
                </button>
                <button
                  className="button button--ghost"
                  disabled={photo.isPrimary || isActionPending}
                  onClick={() => {
                    setPrimary.reset();
                    setPrimary.mutate(photo.id);
                  }}
                >
                  {photo.isPrimary ? 'Уже главное' : 'Сделать главным'}
                </button>
                <button
                  className="button button--danger"
                  disabled={isActionPending}
                  onClick={() => {
                    if (!window.confirm('Удалить это фото с сервера?')) {
                      return;
                    }

                    deletePhoto.reset();
                    deletePhoto.mutate(photo.id);
                  }}
                >
                  Удалить
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
