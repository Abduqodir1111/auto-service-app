import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReportTargetType, UserRole, WorkshopDetails } from '@stomvp/shared';
import { Field } from '../../components/field';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/auth-store';
import { syncFavoriteCaches } from '../../src/utils/favorites-cache';
import { openExternalMap } from '../../src/utils/maps';
import { track } from '../../src/utils/analytics';

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

export default function WorkshopDetailsScreen() {
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const insets = useSafeAreaInsets();
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [reportNotice, setReportNotice] = useState<string | null>(null);

  const workshopQuery = useQuery({
    queryKey: ['workshop', params.id],
    queryFn: async () => {
      const { data } = await api.get<WorkshopDetails>(`/workshops/${params.id}`);
      return data;
    },
  });

  // workshop_viewed: fire once per id navigation. Tracks intent to view —
  // not whether the fetch succeeded (404s still count as a view attempt).
  useEffect(() => {
    if (params.id) {
      track('workshop_viewed', { workshopId: params.id });
    }
  }, [params.id]);

  const favoriteMutation = useMutation({
    mutationFn: async (nextIsFavorite: boolean) => {
      if (nextIsFavorite) {
        await api.post(`/favorites/${params.id}`);
        return;
      }

      await api.delete(`/favorites/${params.id}`);
    },
    onMutate: async (nextIsFavorite) => {
      if (!workshopQuery.data) {
        return null;
      }

      const rollback = syncFavoriteCaches(queryClient, workshopQuery.data, nextIsFavorite);
      return { rollback };
    },
    onError: (_error, _nextIsFavorite, context) => {
      context?.rollback?.();
      Alert.alert('Не удалось обновить избранное', 'Попробуйте ещё раз.');
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['favorites'] }),
        queryClient.invalidateQueries({ queryKey: ['workshop', params.id] }),
        queryClient.invalidateQueries({ queryKey: ['workshops'] }),
      ]);
    },
  });
  const reviewMutation = useMutation({
    mutationFn: async () => {
      await api.post('/reviews', {
        workshopId: params.id,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
    },
    onSuccess: async () => {
      setReviewComment('');
      setReviewRating(5);
      setReviewNotice('Отзыв опубликован, а рейтинг карточки уже обновлён.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workshop', params.id] }),
        queryClient.invalidateQueries({ queryKey: ['workshops'] }),
        queryClient.invalidateQueries({ queryKey: ['workshops-map'] }),
        queryClient.invalidateQueries({ queryKey: ['favorites'] }),
      ]);
    },
    onError: (error) => {
      Alert.alert(
        'Не удалось отправить отзыв',
        getApiErrorMessage(
          error,
          'Проверьте оценку и комментарий, затем попробуйте ещё раз.',
        ),
      );
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (payload: {
      targetType: ReportTargetType;
      targetId: string;
      reason: string;
      comment?: string;
    }) => {
      await api.post('/reports', payload);
    },
    onSuccess: () => {
      setReportNotice('Жалоба отправлена модератору. Спасибо, что помогаете держать каталог чистым.');
    },
    onError: (error) => {
      Alert.alert(
        'Не удалось отправить жалобу',
        getApiErrorMessage(error, 'Проверьте подключение и попробуйте ещё раз.'),
      );
    },
  });

  const workshop = workshopQuery.data;
  const canReview = session?.user.role === UserRole.CLIENT && session.user.id !== workshop?.ownerId;
  const isFavorite = workshop?.isFavorite ?? false;

  if (!workshop) {
    return (
      <Screen edges={['left', 'right', 'bottom']} style={styles.screenContent}>
        <Text>Загружаем карточку...</Text>
      </Screen>
    );
  }

  const hasCoordinates = workshop.latitude != null && workshop.longitude != null;
  const coverPhotos = workshop.photos.length ? workshop.photos : [];

  const submitReport = (targetType: ReportTargetType, targetId: string, label: string) => {
    if (!session) {
      Alert.alert('Нужен вход', 'Чтобы отправить жалобу, войдите в аккаунт.');
      return;
    }

    Alert.alert('Отправить жалобу?', `Модератор проверит: ${label}.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Отправить',
        onPress: () =>
          reportMutation.mutate({
            targetType,
            targetId,
            reason: label,
            comment: `Пользователь сообщил о проблеме: ${label}`,
          }),
      },
    ]);
  };

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      refreshing={workshopQuery.isRefetching}
      onRefresh={() => void workshopQuery.refetch()}
      style={styles.screenContent}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} style={styles.topBarButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>Карточка СТО</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.hero}>
        <View style={styles.heroTitleRow}>
          <Text style={styles.title}>{workshop.title}</Text>
          {workshop.isVerifiedMaster ? (
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={15} color="#FFFFFF" />
              <Text style={styles.verifiedBadgeText}>Проверенный мастер</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.subtitle}>
          {workshop.city}, {workshop.addressLine}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.photoRail}
      >
        {coverPhotos.length ? (
          coverPhotos.map((photo) => (
            <View key={photo.id} style={styles.heroPhotoWrap}>
              <Image source={{ uri: photo.url }} style={styles.heroPhoto} />
              <Pressable
                disabled={reportMutation.isPending}
                onPress={() =>
                  submitReport(ReportTargetType.PHOTO, photo.id, 'Проблема с фото')
                }
                style={styles.photoReportButton}
              >
                <Ionicons name="flag-outline" size={16} color={colors.accentDark} />
              </Pressable>
            </View>
          ))
        ) : (
          <View style={styles.heroPhotoEmpty}>
            <Ionicons name="image-outline" size={28} color={colors.accentDark} />
            <Text style={styles.heroPhotoEmptyText}>Фото появятся после загрузки мастером</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.card}>
        <Text style={styles.description}>{workshop.description}</Text>
        <Text style={styles.meta}>Контакты: {workshop.phone}</Text>
        <Text style={styles.meta}>График: {workshop.openingHours || 'Уточняйте по телефону'}</Text>
        <Text style={styles.meta}>
          Рейтинг {workshop.averageRating.toFixed(1)} • {workshop.reviewsCount} отзывов
        </Text>
        {workshop.isVerifiedMaster ? (
          <Text style={styles.verifiedText}>
            Мастер проверен модератором MasterTop.
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.locationHeader}>
          <Text style={styles.sectionTitle}>Локация</Text>
          {hasCoordinates ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/map/view',
                  params: {
                    latitude: String(workshop.latitude),
                    longitude: String(workshop.longitude),
                    title: workshop.title,
                    address: `${workshop.city}, ${workshop.addressLine}`,
                  },
                })
              }
              style={styles.locationChip}
            >
              <Ionicons name="location-outline" size={16} color={colors.accentDark} />
              <Text style={styles.locationChipText}>Открыть карту</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.meta}>
          {workshop.city}, {workshop.addressLine}
        </Text>

        {hasCoordinates ? (
          <Pressable
            onPress={() =>
              openExternalMap(
                workshop.latitude as number,
                workshop.longitude as number,
                workshop.title,
              )
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryText}>Построить маршрут</Text>
          </Pressable>
        ) : (
          <Text style={styles.meta}>Точная точка на карте пока не указана.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Услуги и цены</Text>
        {workshop.services.map((service) => (
          <View key={service.id} style={styles.serviceRow}>
            <View style={styles.serviceCopy}>
              <Text style={styles.serviceName}>{service.name}</Text>
              {service.description ? (
                <Text style={styles.serviceDescription}>{service.description}</Text>
              ) : null}
            </View>
            <Text style={styles.servicePrice}>
              {service.priceFrom ?? '—'} / {service.priceTo ?? '—'}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => Linking.openURL(`tel:${workshop.phone}`)}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryText}>Позвонить</Text>
        </Pressable>
        <Pressable
          disabled={favoriteMutation.isPending}
          onPress={() => favoriteMutation.mutate(!isFavorite)}
          style={({ pressed }) => [
            styles.secondaryButton,
            isFavorite && styles.favoriteButtonActive,
            pressed && !favoriteMutation.isPending && styles.buttonPressed,
            favoriteMutation.isPending && styles.disabledButton,
          ]}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={18}
            color={isFavorite ? '#FFFFFF' : colors.accentDark}
          />
          <Text style={[styles.secondaryText, isFavorite && styles.secondaryTextActive]}>
            {isFavorite ? 'Убрать' : 'В избранное'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() =>
          router.push({ pathname: '/requests/create', params: { workshopId: workshop.id } })
        }
        style={styles.requestButton}
      >
        <Text style={styles.primaryText}>Оставить заявку</Text>
      </Pressable>

      <Pressable
        disabled={reportMutation.isPending}
        onPress={() =>
          submitReport(ReportTargetType.WORKSHOP, workshop.id, 'Проблема с объявлением')
        }
        style={styles.reportButton}
      >
        <Ionicons name="flag-outline" size={18} color={colors.accentDark} />
        <Text style={styles.reportButtonText}>
          {reportMutation.isPending ? 'Отправляем жалобу...' : 'Пожаловаться на объявление'}
        </Text>
      </Pressable>

      {reportNotice ? <Text style={styles.reportNotice}>{reportNotice}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Отзывы</Text>
        {canReview ? (
          <View style={styles.reviewComposer}>
            <Text style={styles.reviewComposerTitle}>Оставить отзыв</Text>
            <Text style={styles.meta}>
              Поставьте оценку и напишите комментарий. Отзыв и рейтинг появятся сразу.
            </Text>

            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((value) => {
                const active = value <= reviewRating;

                return (
                  <Pressable
                    key={value}
                    onPress={() => setReviewRating(value)}
                    style={[styles.ratingChip, active && styles.ratingChipActive]}
                  >
                    <Ionicons
                      name={active ? 'star' : 'star-outline'}
                      size={18}
                      color={active ? '#FFFFFF' : colors.warning}
                    />
                    <Text style={[styles.ratingChipText, active && styles.ratingChipTextActive]}>
                      {value}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Field
              label="Комментарий"
              multiline
              value={reviewComment}
              onChangeText={(value) => {
                setReviewNotice(null);
                setReviewComment(value);
              }}
              placeholder="Например: быстро приняли, всё объяснили и сделали аккуратно."
            />

            {reviewNotice ? <Text style={styles.reviewNotice}>{reviewNotice}</Text> : null}

            <Pressable
              disabled={reviewMutation.isPending || reviewComment.trim().length < 6}
              onPress={() => reviewMutation.mutate()}
              style={[
                styles.primaryButton,
                (reviewMutation.isPending || reviewComment.trim().length < 6) &&
                  styles.disabledButton,
              ]}
            >
              <Text style={styles.primaryText}>
                {reviewMutation.isPending ? 'Отправляем отзыв...' : 'Отправить отзыв'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {workshop.reviews.length ? (
          workshop.reviews.map((review) => (
            <View key={review.id} style={styles.review}>
              <View style={styles.reviewHeader}>
                <Text style={styles.serviceName}>{review.author.fullName}</Text>
                <Pressable
                  disabled={reportMutation.isPending}
                  onPress={() =>
                    submitReport(ReportTargetType.REVIEW, review.id, 'Проблема с отзывом')
                  }
                  style={styles.reviewReportButton}
                >
                  <Ionicons name="flag-outline" size={14} color={colors.accentDark} />
                  <Text style={styles.reviewReportText}>Жалоба</Text>
                </Pressable>
              </View>
              <Text style={styles.meta}>Оценка {review.rating}/5</Text>
              <Text style={styles.reviewText}>{review.comment}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.meta}>
            Пока нет опубликованных отзывов. Потяните экран вниз, чтобы обновить карточку после
            модерации.
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingTop: 0,
    paddingBottom: 28,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  topBarButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  topBarSpacer: {
    width: 44,
    height: 44,
  },
  hero: {
    gap: 4,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  verifiedBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  verifiedText: {
    color: colors.success,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
  },
  photoRail: {
    gap: 12,
    paddingRight: 20,
  },
  heroPhotoWrap: {
    width: 276,
    height: 196,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFF1E7',
  },
  heroPhoto: {
    width: 276,
    height: 196,
    borderRadius: 24,
    backgroundColor: '#FFF1E7',
  },
  photoReportButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 38,
    height: 38,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 253, 249, 0.92)',
    borderWidth: 1,
    borderColor: '#F1D1BC',
  },
  heroPhotoEmpty: {
    width: 276,
    height: 196,
    borderRadius: 24,
    backgroundColor: '#FFF1E7',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  heroPhotoEmptyText: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  description: {
    lineHeight: 21,
    color: colors.text,
  },
  meta: {
    color: colors.muted,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFF0E5',
  },
  locationChipText: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  serviceCopy: {
    flex: 1,
    gap: 4,
  },
  serviceName: {
    fontWeight: '700',
    color: colors.text,
  },
  serviceDescription: {
    color: colors.muted,
    lineHeight: 19,
  },
  servicePrice: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: '#FFF0E5',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: {
    color: 'white',
    fontWeight: '700',
  },
  secondaryText: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  secondaryTextActive: {
    color: '#FFFFFF',
  },
  favoriteButtonActive: {
    backgroundColor: colors.danger,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  requestButton: {
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: colors.success,
    alignItems: 'center',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#FFF0E5',
    borderWidth: 1,
    borderColor: '#F1D1BC',
  },
  reportButtonText: {
    color: colors.accentDark,
    fontWeight: '800',
  },
  reportNotice: {
    color: colors.success,
    lineHeight: 20,
    fontWeight: '700',
  },
  review: {
    paddingVertical: 8,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reviewReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFF0E5',
  },
  reviewReportText: {
    color: colors.accentDark,
    fontSize: 12,
    fontWeight: '800',
  },
  reviewText: {
    color: colors.text,
    lineHeight: 20,
  },
  reviewComposer: {
    gap: 12,
    paddingBottom: 8,
  },
  reviewComposerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  ratingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFF6E3',
    borderWidth: 1,
    borderColor: '#F0D9A7',
  },
  ratingChipActive: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  ratingChipText: {
    color: colors.warning,
    fontWeight: '700',
  },
  ratingChipTextActive: {
    color: '#FFFFFF',
  },
  reviewNotice: {
    color: colors.success,
    lineHeight: 20,
  },
  disabledButton: {
    opacity: 0.55,
  },
});
