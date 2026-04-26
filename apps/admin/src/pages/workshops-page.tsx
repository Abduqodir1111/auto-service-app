import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { PhotoStatus, WorkshopStatus } from '@stomvp/shared';
import { useMemo, useState } from 'react';
import { http } from '../api/http';
import { AdminWorkshop } from '../api/types';
import { StatusBadge } from '../components/status-badge';
import { formatPriceRange } from '../lib/format';

const photoStatusLabels: Record<PhotoStatus, string> = {
  [PhotoStatus.PENDING]: 'На проверке',
  [PhotoStatus.APPROVED]: 'Одобрено',
  [PhotoStatus.REJECTED]: 'Отклонено',
};

export function WorkshopsPage() {
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'workshops'],
    queryFn: async () => {
      const response = await http.get<AdminWorkshop[]>('/admin/workshops');
      return response.data;
    },
  });

  const moderate = useMutation({
    mutationFn: async (payload: {
      id: string;
      status: WorkshopStatus;
      rejectionReason?: string;
      approvePendingPhotos?: boolean;
    }) => {
      await http.patch(`/admin/workshops/${payload.id}/moderate`, {
        status: payload.status,
        rejectionReason: payload.rejectionReason,
        approvePendingPhotos: payload.approvePendingPhotos,
      });
      return payload;
    },
    onSuccess: (payload) => {
      queryClient.setQueryData<AdminWorkshop[]>(['admin', 'workshops'], (current) =>
        (current ?? []).map((item) =>
          item.id === payload.id
            ? {
                ...item,
                status: payload.status,
                rejectionReason: payload.rejectionReason ?? null,
                photos:
                  payload.status === WorkshopStatus.APPROVED && payload.approvePendingPhotos
                    ? item.photos.map((photo) =>
                        photo.status === PhotoStatus.PENDING
                          ? {
                              ...photo,
                              status: PhotoStatus.APPROVED,
                            }
                          : photo,
                      )
                    : item.photos,
              }
            : item,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: ['admin', 'workshops'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'photos'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] });
    },
  });

  const photoAction = useMutation({
    mutationFn: async (payload: {
      workshopId: string;
      photoId: string;
      action: 'delete' | 'primary';
    }) => {
      if (payload.action === 'delete') {
        await http.delete(`/uploads/photos/${payload.photoId}`);
      } else {
        await http.patch(`/uploads/photos/${payload.photoId}/primary`);
      }

      return payload;
    },
    onSuccess: (payload) => {
      queryClient.setQueryData<AdminWorkshop[]>(['admin', 'workshops'], (current) =>
        (current ?? []).map((item) => {
          if (item.id !== payload.workshopId) {
            return item;
          }

          return {
            ...item,
            photos:
              payload.action === 'delete'
                ? item.photos.filter((photo) => photo.id !== payload.photoId)
                : item.photos.map((photo) => ({
                    ...photo,
                    isPrimary: photo.id === payload.photoId,
                  })),
          };
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ['admin', 'workshops'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'photos'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] });
    },
  });

  const mutationError =
    [moderate.error, photoAction.error].find((error) => axios.isAxiosError(error));

  const mutationErrorText =
    mutationError && axios.isAxiosError(mutationError)
      ? typeof mutationError.response?.data?.message === 'string'
        ? mutationError.response?.data?.message
        : Array.isArray(mutationError.response?.data?.message)
          ? mutationError.response?.data?.message.join(', ')
        : 'Не удалось изменить статус карточки.'
      : null;

  const isActionPending = moderate.isPending || photoAction.isPending;

  const orderedWorkshops = useMemo(() => {
    if (!data) {
      return [];
    }

    const priority: Record<WorkshopStatus, number> = {
      [WorkshopStatus.PENDING]: 0,
      [WorkshopStatus.REJECTED]: 1,
      [WorkshopStatus.DRAFT]: 2,
      [WorkshopStatus.APPROVED]: 3,
      [WorkshopStatus.BLOCKED]: 4,
    };

    return [...data].sort((left, right) => priority[left.status] - priority[right.status]);
  }, [data]);

  return (
    <section className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">СТО и мастера</p>
          <h2>Проверка карточек сервиса</h2>
        </div>
      </header>

      <div className="stack">
        {mutationErrorText ? <div className="alert">{mutationErrorText}</div> : null}
        {isLoading || !data ? (
          <div className="panel">Загружаем мастерские...</div>
        ) : orderedWorkshops.length === 0 ? (
          <div className="panel">Карточек для модерации пока нет.</div>
        ) : (
          orderedWorkshops.map((workshop) => {
            const pendingPhotosCount = workshop.photos.filter(
              (photo) => photo.status === PhotoStatus.PENDING,
            ).length;

            return (
              <article className="panel workshop-card" key={workshop.id}>
              <div className="workshop-card__top">
                <div>
                  <h3>{workshop.title}</h3>
                  <p className="muted">
                    {workshop.city}, {workshop.addressLine}
                  </p>
                </div>
                <StatusBadge
                  tone={
                    workshop.status === WorkshopStatus.APPROVED
                      ? 'success'
                      : workshop.status === WorkshopStatus.PENDING
                        ? 'warning'
                        : workshop.status === WorkshopStatus.BLOCKED
                          ? 'danger'
                          : 'neutral'
                  }
                >
                  {workshop.status}
                </StatusBadge>
              </div>

              <p className="muted">
                Владелец: {workshop.owner.fullName} • {workshop.owner.phone}
              </p>

              <div className="actions">
                <StatusBadge tone={workshop.isVerifiedMaster ? 'success' : 'neutral'}>
                  {workshop.isVerifiedMaster ? 'Проверенный мастер' : 'Мастер без бейджа'}
                </StatusBadge>
              </div>

              <p className="muted">
                Фото на проверке: {pendingPhotosCount} • Всего фото: {workshop.photos.length}
              </p>

              {workshop.photos.length ? (
                <div className="workshop-photo-strip">
                  {workshop.photos.map((photo) => (
                    <div className="workshop-photo" key={photo.id}>
                      <img alt={workshop.title} src={photo.url} />
                      <div className="workshop-photo__meta">
                        <span>{photoStatusLabels[photo.status]}</span>
                        {photo.isPrimary ? <strong>Главное</strong> : null}
                      </div>
                      <div className="actions">
                        <button
                          className="button button--ghost button--small"
                          disabled={photo.isPrimary || isActionPending}
                          onClick={() => {
                            photoAction.reset();
                            photoAction.mutate({
                              workshopId: workshop.id,
                              photoId: photo.id,
                              action: 'primary',
                            });
                          }}
                        >
                          Главное
                        </button>
                        <button
                          className="button button--danger button--small"
                          disabled={isActionPending}
                          onClick={() => {
                            if (!window.confirm('Удалить это фото с сервера?')) {
                              return;
                            }

                            photoAction.reset();
                            photoAction.mutate({
                              workshopId: workshop.id,
                              photoId: photo.id,
                              action: 'delete',
                            });
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="chips">
                {workshop.categories.map((category) => (
                  <span className="chip" key={category.id}>
                    {category.name}
                  </span>
                ))}
              </div>

              <div className="service-list">
                {workshop.services.map((service) => (
                  <div className="service-item" key={service.id}>
                    <strong>{service.name}</strong>
                    <span>{formatPriceRange(service.priceFrom, service.priceTo)} сом</span>
                  </div>
                ))}
              </div>

              {workshop.rejectionReason ? (
                <div className="alert">{workshop.rejectionReason}</div>
              ) : null}

              <label className="field">
                <span>Причина отклонения / блокировки</span>
                <input
                  value={rejectionReason[workshop.id] ?? ''}
                  onChange={(event) =>
                    setRejectionReason((current) => ({
                      ...current,
                      [workshop.id]: event.target.value,
                    }))
                  }
                  placeholder="Например: не хватает фото или неверный адрес"
                />
              </label>

              <div className="actions">
                <button
                  className="button"
                  disabled={isActionPending}
                  onClick={() => {
                    moderate.reset();
                    moderate.mutate({
                      id: workshop.id,
                      status: WorkshopStatus.APPROVED,
                      approvePendingPhotos: true,
                    });
                  }}
                >
                  Одобрить карточку и фото
                </button>
                <button
                  className="button button--ghost"
                  disabled={isActionPending}
                  onClick={() => {
                    moderate.reset();
                    moderate.mutate({
                      id: workshop.id,
                      status: WorkshopStatus.REJECTED,
                      rejectionReason: rejectionReason[workshop.id],
                    });
                  }}
                >
                  Отклонить
                </button>
                <button
                  className="button button--danger"
                  disabled={isActionPending}
                  onClick={() => {
                    moderate.reset();
                    moderate.mutate({
                      id: workshop.id,
                      status: WorkshopStatus.BLOCKED,
                      rejectionReason: rejectionReason[workshop.id],
                    });
                  }}
                >
                  Заблокировать
                </button>
              </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
