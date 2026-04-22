export function formatDate(value?: string | null) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatPriceRange(from?: number | null, to?: number | null) {
  if (!from && !to) {
    return 'Цена по запросу';
  }

  if (from && to) {
    return `${from} - ${to}`;
  }

  return `от ${from ?? to}`;
}
