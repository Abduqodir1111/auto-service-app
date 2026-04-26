import { PhotoStatus, WorkshopDetails } from '@stomvp/shared';

type WorkshopReadinessInput = {
  title?: string;
  description?: string;
  phone?: string;
  addressLine?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  categoryIds?: string[];
  categories?: Array<unknown>;
  services?: Array<{ name?: string | null }>;
  photos?: Array<{ status?: PhotoStatus | string }>;
};

export type WorkshopReadiness = {
  percent: number;
  readyForModeration: boolean;
  missingRequired: string[];
  missingRecommended: string[];
  nextHints: string[];
};

function countItems(input?: unknown[] | null) {
  return Array.isArray(input) ? input.length : 0;
}

export function getWorkshopReadiness(input: WorkshopReadinessInput): WorkshopReadiness {
  const categoriesCount =
    input.categoryIds != null ? countItems(input.categoryIds) : countItems(input.categories);
  const services = input.services ?? [];
  const photos = input.photos ?? [];

  const checks = [
    {
      ok: (input.title ?? '').trim().length >= 3,
      label: 'название объявления',
      required: true,
    },
    {
      ok: (input.description ?? '').trim().length >= 10,
      label: 'описание минимум 10 символов',
      required: true,
    },
    {
      ok: (input.phone ?? '').trim().length >= 6,
      label: 'контактный телефон',
      required: true,
    },
    {
      ok: (input.city ?? '').trim().length >= 2,
      label: 'город',
      required: true,
    },
    {
      ok: (input.addressLine ?? '').trim().length >= 4,
      label: 'адрес',
      required: true,
    },
    {
      ok: categoriesCount > 0,
      label: 'хотя бы одну категорию',
      required: true,
    },
    {
      ok:
        services.length > 0 &&
        services.every((service) => (service.name ?? '').trim().length >= 2),
      label: 'услугу с названием',
      required: true,
    },
    {
      ok: photos.some((photo) => photo.status !== PhotoStatus.REJECTED),
      label: 'фото объявления',
      required: false,
    },
    {
      ok: input.latitude != null && input.longitude != null,
      label: 'точку на карте',
      required: false,
    },
  ];

  const missingRequired = checks
    .filter((check) => check.required && !check.ok)
    .map((check) => check.label);
  const missingRecommended = checks
    .filter((check) => !check.required && !check.ok)
    .map((check) => check.label);
  const completed = checks.filter((check) => check.ok).length;
  const percent = Math.round((completed / checks.length) * 100);

  return {
    percent,
    readyForModeration: missingRequired.length === 0,
    missingRequired,
    missingRecommended,
    nextHints: [...missingRequired, ...missingRecommended].slice(0, 3),
  };
}

export function getWorkshopReadinessFromDetails(workshop: WorkshopDetails) {
  return getWorkshopReadiness({
    title: workshop.title,
    description: workshop.description,
    phone: workshop.phone,
    addressLine: workshop.addressLine,
    city: workshop.city,
    latitude: workshop.latitude,
    longitude: workshop.longitude,
    categories: workshop.categories,
    services: workshop.services,
    photos: workshop.photos,
  });
}
