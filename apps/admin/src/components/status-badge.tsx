import { ReactNode } from 'react';

type Props = {
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  children: ReactNode;
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Черновик',
  PENDING: 'На модерации',
  APPROVED: 'Одобрено',
  REJECTED: 'Отклонено',
  BLOCKED: 'Заблокировано',
  PUBLISHED: 'Опубликовано',
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
  IN_REVIEW: 'В работе',
  RESOLVED: 'Решена',
  WORKSHOP: 'Объявление',
  PHOTO: 'Фото',
  REVIEW: 'Отзыв',
  USER: 'Пользователь',
  VERIFIED: 'Проверен',
  UNVERIFIED: 'Без бейджа',
  UPDATED: 'Обновлено',
  DELETED: 'Удалено',
};

export function StatusBadge({ tone, children }: Props) {
  const label = typeof children === 'string' ? statusLabels[children] ?? children : children;

  return <span className={`status-badge status-badge--${tone}`}>{label}</span>;
}
