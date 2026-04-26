import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Controller,
  useFieldArray,
  useForm,
} from 'react-hook-form';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { z } from 'zod';
import { PhotoStatus, ServiceCategory, WorkshopDetails, WorkshopStatus } from '@stomvp/shared';
import { Field } from '../../components/field';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { getCategoryIcon } from '../../src/constants/category-meta';
import { colors } from '../../src/constants/theme';
import { useMapPickerStore } from '../../src/store/map-picker-store';
import { getDefaultMapCoordinates, openExternalMap } from '../../src/utils/maps';
import { getWorkshopReadiness } from '../../src/utils/workshop-readiness';

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value === 'string' && value.trim().length === 0) {
    return undefined;
  }

  return value;
};

const serviceSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  priceFrom: z.preprocess(emptyStringToUndefined, z.coerce.number().optional()),
  priceTo: z.preprocess(emptyStringToUndefined, z.coerce.number().optional()),
});

const schema = z.object({
  title: z.string(),
  description: z.string(),
  phone: z.string(),
  telegram: z.string().optional(),
  addressLine: z.string(),
  city: z.string(),
  openingHours: z.string().optional(),
  latitude: z.preprocess(emptyStringToUndefined, z.coerce.number().optional()),
  longitude: z.preprocess(emptyStringToUndefined, z.coerce.number().optional()),
  categoryIds: z.array(z.string()),
  services: z.array(serviceSchema),
});

type FormValues = z.infer<typeof schema>;

type SaveWorkshopPayload = {
  title: string;
  description: string;
  phone: string;
  telegram?: string;
  addressLine: string;
  city: string;
  openingHours?: string;
  latitude?: number;
  longitude?: number;
  categoryIds?: string[];
  services: Array<{
    name: string;
    description?: string;
    priceFrom?: number;
    priceTo?: number;
  }>;
};

const defaultFormValues: FormValues = {
  title: '',
  description: '',
  phone: '',
  telegram: '',
  addressLine: '',
  city: '',
  openingHours: '',
  latitude: undefined,
  longitude: undefined,
  categoryIds: [],
  services: [{ name: '', description: '', priceFrom: undefined, priceTo: undefined }],
};

const statusLabels: Record<WorkshopStatus, string> = {
  [WorkshopStatus.DRAFT]: 'Черновик',
  [WorkshopStatus.PENDING]: 'На модерации',
  [WorkshopStatus.APPROVED]: 'Опубликовано',
  [WorkshopStatus.REJECTED]: 'Отклонено',
  [WorkshopStatus.BLOCKED]: 'Заблокировано',
};

const statusDescriptions: Record<WorkshopStatus, string> = {
  [WorkshopStatus.DRAFT]: 'Заполняйте карточку постепенно. Когда обязательные поля будут готовы, сохранение отправит её на модерацию автоматически.',
  [WorkshopStatus.PENDING]: 'Карточка и фото уже отправлены на проверку администратору.',
  [WorkshopStatus.APPROVED]: 'Карточка опубликована и уже доступна в каталоге для клиентов.',
  [WorkshopStatus.REJECTED]: 'Исправьте карточку по замечанию и повторно отправьте её на проверку.',
  [WorkshopStatus.BLOCKED]: 'Карточка заблокирована. Обратитесь к администратору платформы.',
};

const photoStatusLabels: Record<PhotoStatus, string> = {
  [PhotoStatus.PENDING]: 'На проверке',
  [PhotoStatus.APPROVED]: 'Одобрено',
  [PhotoStatus.REJECTED]: 'Отклонено',
};

const unsavedWorkshopDrafts = new Map<string, FormValues>();

function getApiErrorMessage(error: unknown, fallback: string) {
  const apiMessage = axios.isAxiosError(error) ? error.response?.data?.message : null;

  if (typeof apiMessage === 'string') {
    return apiMessage;
  }

  if (Array.isArray(apiMessage)) {
    return apiMessage.join('\n');
  }

  return fallback;
}

function normalizeFormValues(values?: Partial<FormValues>): FormValues {
  return {
    title: values?.title ?? '',
    description: values?.description ?? '',
    phone: values?.phone ?? '',
    telegram: values?.telegram ?? '',
    addressLine: values?.addressLine ?? '',
    city: values?.city ?? '',
    openingHours: values?.openingHours ?? '',
    latitude: values?.latitude ?? undefined,
    longitude: values?.longitude ?? undefined,
    categoryIds: values?.categoryIds ?? [],
    services:
      values?.services && values.services.length > 0
        ? values.services.map((service) => ({
            name: service.name ?? '',
            description: service.description ?? '',
            priceFrom: service.priceFrom ?? undefined,
            priceTo: service.priceTo ?? undefined,
          }))
        : [{ name: '', description: '', priceFrom: undefined, priceTo: undefined }],
  };
}

function mapWorkshopToForm(workshop: WorkshopDetails): FormValues {
  return normalizeFormValues({
    title: workshop.title,
    description: workshop.description,
    phone: workshop.phone,
    telegram: workshop.telegram ?? '',
    addressLine: workshop.addressLine,
    city: workshop.city,
    openingHours: workshop.openingHours ?? '',
    latitude: workshop.latitude ?? undefined,
    longitude: workshop.longitude ?? undefined,
    categoryIds: workshop.categories.map((item) => item.id),
    services: workshop.services.map((service) => ({
      name: service.name,
      description: service.description ?? '',
      priceFrom: service.priceFrom ?? undefined,
      priceTo: service.priceTo ?? undefined,
    })),
  });
}

function normalizeOptionalText(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildWorkshopPayload(values: FormValues): SaveWorkshopPayload {
  const services = values.services.reduce<SaveWorkshopPayload['services']>((acc, service, index) => {
    const name = service.name.trim();
    const description = service.description?.trim() ?? '';
    const priceFrom = service.priceFrom;
    const priceTo = service.priceTo;
    const hasAnyContent =
      name.length > 0 ||
      description.length > 0 ||
      priceFrom != null ||
      priceTo != null;

    if (!hasAnyContent) {
      return acc;
    }

    if (name.length < 2) {
      throw new Error(`Укажите название услуги хотя бы из 2 символов в блоке #${index + 1}.`);
    }

    acc.push({
      name,
      description: description.length > 0 ? description : undefined,
      priceFrom: priceFrom ?? undefined,
      priceTo: priceTo ?? undefined,
    });

    return acc;
  }, []);

  return {
    title: values.title.trim(),
    description: values.description.trim(),
    phone: values.phone.trim(),
    telegram: normalizeOptionalText(values.telegram),
    addressLine: values.addressLine.trim(),
    city: values.city.trim(),
    openingHours: normalizeOptionalText(values.openingHours),
    latitude: values.latitude ?? undefined,
    longitude: values.longitude ?? undefined,
    categoryIds: values.categoryIds,
    services,
  };
}

export default function WorkshopEditorScreen() {
  const params = useLocalSearchParams<{
    workshopId?: string | string[];
    mode?: string | string[];
    returnToProfile?: string | string[];
  }>();
  const queryClient = useQueryClient();
  const [savedWorkshopId, setSavedWorkshopId] = useState<string | null>(null);
  const hydratedWorkshopIdRef = useRef<string | null>(null);
  const pickedLocation = useMapPickerStore((state) => state.selectedLocation);
  const setPickerInitialLocation = useMapPickerStore((state) => state.setPickerInitialLocation);
  const clearMapPickerState = useMapPickerStore((state) => state.clear);
  const workshopIdParam = useMemo(
    () => (Array.isArray(params.workshopId) ? params.workshopId[0] : params.workshopId),
    [params.workshopId],
  );
  const modeParam = useMemo(
    () => (Array.isArray(params.mode) ? params.mode[0] : params.mode),
    [params.mode],
  );
  const returnToProfileParam = useMemo(
    () => (Array.isArray(params.returnToProfile) ? params.returnToProfile[0] : params.returnToProfile),
    [params.returnToProfile],
  );
  const isCreateMode = modeParam === 'create';
  const shouldReturnToProfileAfterSave = returnToProfileParam === '1';

  const myWorkshopQuery = useQuery({
    queryKey: ['my-workshops'],
    queryFn: async () => {
      const { data } = await api.get<WorkshopDetails[]>('/workshops/owner/mine');
      return data;
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<ServiceCategory[]>('/categories');
      return data;
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultFormValues,
  });

  const workshops = myWorkshopQuery.data ?? [];
  const selectedWorkshop = useMemo(() => {
    if (workshopIdParam) {
      return workshops.find((workshop) => workshop.id === workshopIdParam);
    }

    if (isCreateMode) {
      return undefined;
    }

    return workshops[0];
  }, [isCreateMode, workshopIdParam, workshops]);
  const activeWorkshopId = selectedWorkshop?.id ?? savedWorkshopId;

  useEffect(() => {
    if (selectedWorkshop) {
      const isNewWorkshopSelection = hydratedWorkshopIdRef.current !== selectedWorkshop.id;
      const localDraft = unsavedWorkshopDrafts.get(selectedWorkshop.id);
      const nextValues = localDraft ?? mapWorkshopToForm(selectedWorkshop);

      if (isNewWorkshopSelection || !isDirty) {
        reset(nextValues);
      }

      setSavedWorkshopId(selectedWorkshop.id);
      hydratedWorkshopIdRef.current = selectedWorkshop.id;
      return;
    }

    if (workshopIdParam) {
      const localDraft = unsavedWorkshopDrafts.get(workshopIdParam);

      if (localDraft) {
        reset(localDraft);
        setSavedWorkshopId(workshopIdParam);
        hydratedWorkshopIdRef.current = workshopIdParam;
        return;
      }
    }

    if (!workshopIdParam && (isCreateMode || !myWorkshopQuery.isLoading)) {
      reset(defaultFormValues);
      setSavedWorkshopId(null);
      hydratedWorkshopIdRef.current = null;
    }
  }, [isCreateMode, isDirty, myWorkshopQuery.isLoading, reset, selectedWorkshop, workshopIdParam]);

  useEffect(() => {
    const draftKey = activeWorkshopId ?? workshopIdParam;

    if (!draftKey) {
      return;
    }

    const subscription = watch((values) => {
      unsavedWorkshopDrafts.set(draftKey, normalizeFormValues(values as Partial<FormValues>));
    });

    return () => subscription.unsubscribe();
  }, [activeWorkshopId, watch, workshopIdParam]);

  useEffect(() => {
    if (!pickedLocation) {
      return;
    }

    setValue('latitude', pickedLocation.latitude, { shouldDirty: true });
    setValue('longitude', pickedLocation.longitude, { shouldDirty: true });
    clearMapPickerState();
  }, [clearMapPickerState, pickedLocation, setValue]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'services',
  });

  const selectedCategories = watch('categoryIds');
  const latitude = watch('latitude');
  const longitude = watch('longitude');
  const formSnapshot = watch();
  const photos = selectedWorkshop?.photos ?? [];
  const pendingPhotos = photos.filter((photo) => photo.status === PhotoStatus.PENDING).length;
  const approvedPhotos = photos.filter((photo) => photo.status === PhotoStatus.APPROVED).length;
  const readiness = getWorkshopReadiness({ ...formSnapshot, photos });
  const screenTitle = activeWorkshopId ? 'Редактирование объявления' : 'Новое объявление';
  const screenSubtitle = activeWorkshopId
    ? 'Обновляйте фото, услуги и точку на карте, чтобы карточка в каталоге всегда была актуальной.'
    : 'Черновик создаётся сразу, поэтому фото можно добавлять без отдельного первого сохранения.';

  const mutation = useMutation({
    mutationFn: async (payload: SaveWorkshopPayload) => {
      const targetWorkshopId =
        activeWorkshopId ??
        (
          await api.post<WorkshopDetails>('/workshops/draft')
        ).data.id;
      const { data } = await api.patch<WorkshopDetails>(`/workshops/${targetWorkshopId}`, payload);
      return data;
    },
    onSuccess: async (workshop) => {
      setSavedWorkshopId(workshop.id);
      reset(mapWorkshopToForm(workshop));
      hydratedWorkshopIdRef.current = workshop.id;
      unsavedWorkshopDrafts.delete(workshop.id);
      queryClient.setQueryData<WorkshopDetails[]>(['my-workshops'], (current) => {
        const existing = current ?? [];
        return [workshop, ...existing.filter((item) => item.id !== workshop.id)];
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-workshops'] }),
        queryClient.invalidateQueries({ queryKey: ['workshops'] }),
      ]);

      if (shouldReturnToProfileAfterSave || isCreateMode) {
        router.replace('/(tabs)/profile');
        return;
      }

      if (workshopIdParam !== workshop.id) {
        router.replace({
          pathname: '/master/workshop',
          params: { workshopId: workshop.id },
        });
      }
    },
    onError: (error) => {
      Alert.alert(
        'Не удалось сохранить объявление',
        getApiErrorMessage(error, 'Проверьте поля формы и попробуйте ещё раз.'),
      );
    },
  });

  const refreshWorkshopData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-workshops'] }),
      queryClient.invalidateQueries({ queryKey: ['workshops'] }),
      queryClient.invalidateQueries({ queryKey: ['favorites'] }),
    ]);
  };

  const uploadPhoto = useMutation({
    mutationFn: async () => {
      if (!activeWorkshopId) {
        throw new Error('Сначала сохраните объявление');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.fileName || 'photo.jpg',
        type: asset.mimeType || 'image/jpeg',
      } as never);

      await api.post(`/uploads/workshops/${activeWorkshopId}/photos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },
    onSuccess: refreshWorkshopData,
    onError: (error) => {
      Alert.alert(
        'Ошибка загрузки',
        getApiErrorMessage(error, 'Не удалось загрузить фото. Проверьте сеть и попробуйте ещё раз.'),
      );
    },
  });

  const setPrimaryPhoto = useMutation({
    mutationFn: async (photoId: string) => {
      await api.patch(`/uploads/photos/${photoId}/primary`);
    },
    onSuccess: refreshWorkshopData,
    onError: (error) => {
      Alert.alert(
        'Не удалось выбрать главное фото',
        getApiErrorMessage(error, 'Проверьте подключение и попробуйте ещё раз.'),
      );
    },
  });

  const deletePhoto = useMutation({
    mutationFn: async (photoId: string) => {
      await api.delete(`/uploads/photos/${photoId}`);
    },
    onSuccess: refreshWorkshopData,
    onError: (error) => {
      Alert.alert(
        'Не удалось удалить фото',
        getApiErrorMessage(error, 'Проверьте подключение и попробуйте ещё раз.'),
      );
    },
  });

  const isPhotoActionBusy = uploadPhoto.isPending || setPrimaryPhoto.isPending || deletePhoto.isPending;

  const confirmDeletePhoto = (photoId: string) => {
    Alert.alert('Удалить фото?', 'Фото удалится из объявления и с сервера.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => deletePhoto.mutate(photoId),
      },
    ]);
  };

  const openLocationPicker = () => {
    const fallback = getDefaultMapCoordinates();
    setPickerInitialLocation({
      latitude: latitude ?? fallback.latitude,
      longitude: longitude ?? fallback.longitude,
      updatedAt: Date.now(),
    });
    router.push('/map/picker');
  };

  const submitSave = (values: FormValues) => {
    try {
      const payload = buildWorkshopPayload(values);
      mutation.mutate(payload);
    } catch (error) {
      Alert.alert(
        'Не удалось сохранить объявление',
        error instanceof Error ? error.message : 'Проверьте поля формы и попробуйте ещё раз.',
      );
    }
  };

  return (
    <Screen edges={['left', 'right', 'bottom']} style={styles.screenContent}>
      <View style={styles.hero}>
        <View style={styles.heroHead}>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>{screenTitle}</Text>
            <Text style={styles.subtitle}>{screenSubtitle}</Text>
          </View>
          {selectedWorkshop ? (
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{statusLabels[selectedWorkshop.status]}</Text>
            </View>
          ) : null}
        </View>
        {selectedWorkshop?.rejectionReason ? (
          <View style={styles.noticeCard}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
            <Text style={styles.noticeText}>{selectedWorkshop.rejectionReason}</Text>
          </View>
        ) : null}
        {selectedWorkshop ? (
          <View style={styles.stageCard}>
            <Text style={styles.stageLabel}>Текущая стадия</Text>
            <Text style={styles.stageTitle}>{statusLabels[selectedWorkshop.status]}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${readiness.percent}%` }]} />
            </View>
            <Text style={styles.stageDescription}>
              {statusDescriptions[selectedWorkshop.status]}
            </Text>
            <Text style={styles.stageMeta}>
              Фото: {approvedPhotos} одобрено • {pendingPhotos} на проверке
            </Text>
            {readiness.nextHints.length ? (
              <Text style={styles.stageHint}>
                Осталось добавить: {readiness.nextHints.join(', ')}.
              </Text>
            ) : (
              <Text style={styles.stageHint}>
                Всё важное заполнено. При сохранении карточка автоматически уйдёт на модерацию.
              </Text>
            )}
          </View>
        ) : null}
      </View>

      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <Field
            label="Название объявления"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.title?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <Field
            label="Описание"
            multiline
            value={field.value}
            onChangeText={field.onChange}
            error={errors.description?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <Field
            label="Телефон"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.phone?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="telegram"
        render={({ field }) => (
          <Field
            label="Telegram / username"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.telegram?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="addressLine"
        render={({ field }) => (
          <Field
            label="Адрес"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.addressLine?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="city"
        render={({ field }) => (
          <Field
            label="Город"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.city?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="openingHours"
        render={({ field }) => (
          <Field
            label="График работы"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.openingHours?.message}
          />
        )}
      />

      <View style={styles.mapSection}>
        <View style={styles.mapSectionHeader}>
          <Ionicons name="location-outline" size={20} color={colors.accentDark} />
          <Text style={styles.sectionTitle}>Локация на карте</Text>
        </View>

        <View style={styles.locationCard}>
          {latitude != null && longitude != null ? (
            <>
              <Text style={styles.locationTitle}>Точка выбрана</Text>
              <Text style={styles.locationValue}>
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.locationTitle}>Точка пока не выбрана</Text>
              <Text style={styles.locationHint}>
                Добавьте геометку, чтобы клиент мог открыть объявление сразу на карте.
              </Text>
            </>
          )}

          <View style={styles.locationActions}>
            <Pressable onPress={openLocationPicker} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>
                {latitude != null && longitude != null ? 'Изменить точку' : 'Выбрать на карте'}
              </Text>
            </Pressable>

            {latitude != null && longitude != null ? (
              <Pressable
                onPress={() => openExternalMap(latitude, longitude, watch('title') || 'Локация СТО')}
                style={styles.ghostButton}
              >
                <Text style={styles.ghostText}>Посмотреть</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.categoryWrap}>
        <Text style={styles.sectionTitle}>Категории услуг</Text>
        <View style={styles.categoryList}>
          {(categoriesQuery.data ?? []).map((category) => {
            const active = selectedCategories.includes(category.id);
            return (
              <Pressable
                key={category.id}
                onPress={() =>
                  setValue(
                    'categoryIds',
                    active
                      ? selectedCategories.filter((item) => item !== category.id)
                      : [...selectedCategories, category.id],
                    { shouldDirty: true },
                  )
                }
                style={[styles.categoryChip, active && styles.categoryChipActive]}
              >
                <Ionicons
                  name={getCategoryIcon(category.slug)}
                  size={16}
                  color={active ? colors.success : colors.text}
                />
                <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {errors.categoryIds?.message ? (
          <Text style={styles.errorText}>{errors.categoryIds.message}</Text>
        ) : null}
      </View>

      <View style={styles.photosSection}>
        <View style={styles.photosHeader}>
          <Text style={styles.sectionTitle}>Фото объявления</Text>
          <Pressable
            onPress={() => uploadPhoto.mutate()}
            disabled={!activeWorkshopId || uploadPhoto.isPending}
            style={[
              styles.secondaryButton,
              styles.photosButton,
              (!activeWorkshopId || uploadPhoto.isPending) && styles.disabledButton,
            ]}
          >
            <Text style={styles.secondaryText}>
              {uploadPhoto.isPending ? 'Загружаем...' : 'Добавить фото'}
            </Text>
          </Pressable>
        </View>

        {photos.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoRail}
          >
            {photos.map((photo) => (
              <View key={photo.id} style={styles.photoCard}>
                <View style={styles.photoImageWrap}>
                  <Image source={{ uri: photo.url }} style={styles.photoImage} />
                  {photo.isPrimary ? (
                    <View style={styles.primaryPhotoBadge}>
                      <Text style={styles.primaryPhotoBadgeText}>Главное фото</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.photoBody}>
                  <Text style={styles.photoStatusText}>{photoStatusLabels[photo.status]}</Text>
                  <View style={styles.photoActions}>
                    <Pressable
                      onPress={() => setPrimaryPhoto.mutate(photo.id)}
                      disabled={photo.isPrimary || isPhotoActionBusy}
                      style={[
                        styles.photoActionButton,
                        photo.isPrimary && styles.photoActionButtonDisabled,
                      ]}
                    >
                      <Text style={styles.photoActionText}>
                        {photo.isPrimary ? 'Выбрано' : 'Главное'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDeletePhoto(photo.id)}
                      disabled={isPhotoActionBusy}
                      style={[styles.photoActionButton, styles.photoDeleteButton]}
                    >
                      <Text style={[styles.photoActionText, styles.photoDeleteText]}>Удалить</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.photoEmpty}>
            <Ionicons name="image-outline" size={22} color={colors.muted} />
            <Text style={styles.photoEmptyText}>
              Фото можно добавлять сразу в черновик. В каталоге они появятся после одобрения
              администратором.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.servicesWrap}>
        <Text style={styles.sectionTitle}>Услуги и цены</Text>
        {fields.map((field, index) => (
          <View key={field.id} style={styles.serviceCard}>
            <Controller
              control={control}
              name={`services.${index}.name`}
              render={({ field }) => (
                <Field
                  label="Услуга"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={errors.services?.[index]?.name?.message}
                />
              )}
            />

            <Controller
              control={control}
              name={`services.${index}.description`}
              render={({ field }) => (
                <Field
                  label="Короткое описание"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={errors.services?.[index]?.description?.message}
                />
              )}
            />

            <Controller
              control={control}
              name={`services.${index}.priceFrom`}
              render={({ field }) => (
                <Field
                  label="Цена от"
                  keyboardType="numeric"
                  value={field.value ? String(field.value) : ''}
                  onChangeText={field.onChange}
                />
              )}
            />

            <Controller
              control={control}
              name={`services.${index}.priceTo`}
              render={({ field }) => (
                <Field
                  label="Цена до"
                  keyboardType="numeric"
                  value={field.value ? String(field.value) : ''}
                  onChangeText={field.onChange}
                />
              )}
            />

            {fields.length > 1 ? (
              <Pressable onPress={() => remove(index)} style={styles.ghostButton}>
                <Text style={styles.ghostText}>Удалить услугу</Text>
              </Pressable>
            ) : null}
          </View>
        ))}

        <Pressable
          onPress={() =>
            append({ name: '', description: '', priceFrom: undefined, priceTo: undefined })
          }
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryText}>Добавить ещё услугу</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={handleSubmit(submitSave)}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryText}>
          {mutation.isPending ? 'Сохраняем объявление...' : 'Сохранить объявление'}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingTop: 8,
    paddingBottom: 28,
  },
  hero: {
    gap: 8,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    color: colors.muted,
    lineHeight: 20,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFF0E5',
    borderWidth: 1,
    borderColor: '#F1D1BC',
  },
  statusBadgeText: {
    color: colors.accentDark,
    fontWeight: '700',
    fontSize: 12,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFF7DD',
    borderWidth: 1,
    borderColor: '#EEDDAB',
  },
  noticeText: {
    flex: 1,
    color: colors.text,
    lineHeight: 20,
  },
  stageCard: {
    backgroundColor: '#F8F5EF',
    borderRadius: 20,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stageLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  stageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  stageDescription: {
    color: colors.text,
    lineHeight: 20,
  },
  stageMeta: {
    color: colors.muted,
    fontWeight: '600',
  },
  stageHint: {
    color: colors.accentDark,
    fontWeight: '700',
    lineHeight: 20,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#ECE5DA',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  sectionTitle: {
    fontWeight: '800',
    color: colors.text,
    fontSize: 18,
  },
  mapSection: {
    gap: 10,
  },
  mapSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationCard: {
    gap: 10,
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  locationValue: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  locationHint: {
    color: colors.muted,
    lineHeight: 20,
  },
  locationActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  categoryWrap: {
    gap: 10,
  },
  categoryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryChipActive: {
    borderColor: colors.success,
    backgroundColor: '#EAF4F1',
  },
  categoryText: {
    color: colors.text,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: colors.success,
  },
  photosSection: {
    gap: 10,
  },
  photosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  photosButton: {
    alignSelf: 'auto',
  },
  disabledButton: {
    opacity: 0.55,
  },
  photoRail: {
    gap: 12,
    paddingRight: 12,
  },
  photoCard: {
    width: 190,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoImageWrap: {
    height: 122,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoBody: {
    gap: 8,
    padding: 10,
  },
  photoStatusText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  photoActionButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 8,
    backgroundColor: '#EAF4F1',
  },
  photoActionButtonDisabled: {
    opacity: 0.55,
  },
  photoActionText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '800',
  },
  photoDeleteButton: {
    backgroundColor: '#F9E3DC',
  },
  photoDeleteText: {
    color: colors.danger,
  },
  primaryPhotoBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(24, 33, 32, 0.72)',
  },
  primaryPhotoBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  photoEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  photoEmptyText: {
    flex: 1,
    color: colors.muted,
    lineHeight: 20,
  },
  servicesWrap: {
    gap: 12,
  },
  serviceCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#FFF0E5',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  secondaryText: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  ghostButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  ghostText: {
    color: colors.text,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
});
