import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ReportTargetType, UserRole, WorkshopDetails } from '@stomvp/shared';
import type { ReviewItem } from '@stomvp/shared';
import { Field } from '../../components/field';
import { Screen } from '../../components/screen';
import { WorkshopDetailSkeleton } from '../../components/skeleton';
import { AppButton, RetryState } from '../../components/ui';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { showConfirm, showError, showSuccess, showWarning } from '../../src/store/feedback-store';
import { useAuthStore } from '../../src/store/auth-store';
import { syncFavoriteCaches } from '../../src/utils/favorites-cache';
import { callPhone, openRoute, triggerImpact } from '../../src/utils/linking-actions';
import { createLeafletHtml } from '../../src/utils/leaflet-html';
import { track } from '../../src/utils/analytics';
import { clamp, useResponsive } from '../../src/utils/responsive';

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

const ratingValues = [1, 2, 3, 4, 5];
const ratingDistributionValues = [5, 4, 3, 2, 1];

function getRatingCaption(rating: number) {
  if (rating >= 5) return 'Отлично';
  if (rating === 4) return 'Хорошо';
  if (rating === 3) return 'Нормально';
  if (rating === 2) return 'Есть проблемы';
  return 'Плохо';
}

function formatReviewCount(count: number) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return `${count} отзыв`;
  }

  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return `${count} отзыва`;
  }

  return `${count} отзывов`;
}

function formatClientReviewCount(count: number) {
  const base = formatReviewCount(count);
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const clientWord = lastDigit === 1 && lastTwoDigits !== 11 ? 'клиента' : 'клиентов';

  return `${base} ${clientWord}`;
}

function formatReviewDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return 'К';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function InlineStars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={styles.inlineStars}>
      {ratingValues.map((value) => (
        <Ionicons
          key={value}
          name={value <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={colors.warning}
        />
      ))}
    </View>
  );
}

function AnimatedRatingStar({
  value,
  active,
  selected,
  onPress,
}: {
  value: number;
  active: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(active ? 1 : 0.92)).current;
  const glow = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: selected ? 1.14 : active ? 1 : 0.92,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: active ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [active, glow, scale, selected]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.ratingStarButton,
        active && styles.ratingStarButtonActive,
        pressed && styles.buttonPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Поставить оценку ${value} из 5`}
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={[styles.ratingStarGlow, { opacity: glow }]} />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={active ? 'star' : 'star-outline'}
          size={selected ? 30 : 28}
          color={active ? '#FFFFFF' : colors.warning}
        />
      </Animated.View>
    </Pressable>
  );
}

function ReviewCard({
  review,
  index,
  onReport,
  disabled,
}: {
  review: ReviewItem;
  index: number;
  onReport: () => void;
  disabled: boolean;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const translateY = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      delay: Math.min(index * 45, 180),
      useNativeDriver: true,
    }).start();
  }, [enter, index]);

  const authorName = review.author.fullName || 'Клиент';

  return (
    <Animated.View style={[styles.review, { opacity: enter, transform: [{ translateY }] }]}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewAuthorRow}>
          <View style={styles.reviewAvatar}>
            <Text style={styles.reviewAvatarText}>{getInitials(authorName)}</Text>
          </View>
          <View style={styles.reviewAuthorCopy}>
            <Text style={styles.serviceName}>{authorName}</Text>
            <Text style={styles.reviewDate}>{formatReviewDate(review.createdAt)}</Text>
          </View>
        </View>
        <View style={styles.reviewRatingBadge}>
          <Ionicons name="star" size={13} color="#FFFFFF" />
          <Text style={styles.reviewRatingBadgeText}>{review.rating}/5</Text>
        </View>
      </View>
      <InlineStars rating={review.rating} />
      <Text style={styles.reviewText}>{review.comment}</Text>
      <Pressable
        disabled={disabled}
        onPress={onReport}
        style={styles.reviewReportButton}
        accessibilityRole="button"
        accessibilityLabel="Пожаловаться на отзыв"
      >
        <Ionicons name="flag-outline" size={14} color={colors.accentDark} />
        <Text style={styles.reviewReportText}>Жалоба</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function WorkshopDetailsScreen() {
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const insets = useSafeAreaInsets();
  const layout = useResponsive();
  const compact = layout.isSmallPhone;
  const topBarPaddingTop = Math.max(insets.top - layout.verticalScale(4), compact ? 4 : 8);
  const topBarButtonSize = compact ? 40 : 44;
  const heroPhotoWidth = clamp(
    layout.contentWidth * (compact ? 0.78 : 0.74),
    compact ? 226 : 250,
    layout.isTablet ? 380 : 310,
  );
  const heroPhotoHeight = Math.round(heroPhotoWidth * 0.68);
  const cardAdaptiveStyle = {
    borderRadius: compact ? 18 : 22,
    padding: compact ? 14 : 18,
    gap: compact ? 8 : 10,
  };
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  const workshopQuery = useQuery({
    queryKey: ['workshop', params.id],
    enabled: Boolean(params.id),
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
      showError('Не удалось обновить избранное', 'Попробуйте ещё раз.');
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
      showSuccess('Отзыв опубликован', 'Рейтинг карточки обновлён.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workshop', params.id] }),
        queryClient.invalidateQueries({ queryKey: ['workshops'] }),
        queryClient.invalidateQueries({ queryKey: ['workshops-map'] }),
        queryClient.invalidateQueries({ queryKey: ['favorites'] }),
      ]);
    },
    onError: (error) => {
      showError(
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
      showSuccess('Жалоба отправлена', 'Модератор проверит обращение.');
    },
    onError: (error) => {
      showError(
        'Не удалось отправить жалобу',
        getApiErrorMessage(error, 'Проверьте подключение и попробуйте ещё раз.'),
      );
    },
  });

  const workshop = workshopQuery.data;
  const canReview = session?.user.role === UserRole.CLIENT && session.user.id !== workshop?.ownerId;
  const isFavorite = workshop?.isFavorite ?? false;
  const hasCoordinates = workshop?.latitude != null && workshop.longitude != null;
  const reviewStats = useMemo(() => {
    const reviews = workshop?.reviews ?? [];
    const total = reviews.length;
    const average =
      total > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / total
        : workshop?.averageRating ?? 0;

    return {
      average,
      total,
      distribution: ratingDistributionValues.map((rating) => {
        const count = reviews.filter((review) => review.rating === rating).length;

        return {
          rating,
          count,
          percent: total > 0 ? Math.round((count / total) * 100) : 0,
        };
      }),
    };
  }, [workshop?.averageRating, workshop?.reviews]);
  const reviewCommentLength = reviewComment.trim().length;
  const canSubmitReview = reviewCommentLength >= 6 && !reviewMutation.isPending;
  const locationHtml = useMemo(() => {
    if (!hasCoordinates || !workshop) {
      return null;
    }

    return createLeafletHtml({
      latitude: workshop.latitude as number,
      longitude: workshop.longitude as number,
      title: workshop.title,
      subtitle: `${workshop.city}, ${workshop.addressLine}`,
    });
  }, [hasCoordinates, workshop]);

  if (!workshop) {
    return (
      <Screen
        edges={['left', 'right', 'bottom']}
        style={[styles.screenContent, { paddingBottom: compact ? 20 : 28 }]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.topBar, { paddingTop: topBarPaddingTop }]}>
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.topBarButton,
              {
                width: topBarButtonSize,
                height: topBarButtonSize,
                borderRadius: compact ? 14 : 16,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Назад"
          >
            <Ionicons name="chevron-back" size={compact ? 22 : 24} color={colors.text} />
          </Pressable>
          <Text style={[styles.topBarTitle, { fontSize: layout.font(18, 0.2, 16, 18) }]}>
            Карточка СТО
          </Text>
          <View style={{ width: topBarButtonSize, height: topBarButtonSize }} />
        </View>
        {workshopQuery.isError ? (
          <RetryState
            title="Карточка не загрузилась"
            text="Проверьте интернет или попробуйте открыть объявление ещё раз."
            onRetry={() => void workshopQuery.refetch()}
            loading={workshopQuery.isRefetching}
          />
        ) : (
          <WorkshopDetailSkeleton />
        )}
      </Screen>
    );
  }

  const coverPhotos = workshop.photos.length ? workshop.photos : [];

  const submitReport = (targetType: ReportTargetType, targetId: string, label: string) => {
    if (!session) {
      showWarning('Нужен вход', 'Чтобы отправить жалобу, войдите в аккаунт.');
      return;
    }

    showConfirm({
      title: 'Отправить жалобу?',
      message: `Модератор проверит: ${label}.`,
      confirmLabel: 'Отправить',
      onConfirm: () =>
        reportMutation.mutate({
          targetType,
          targetId,
          reason: label,
          comment: `Пользователь сообщил о проблеме: ${label}`,
        }),
    });
  };

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      refreshing={workshopQuery.isRefetching}
      onRefresh={() => void workshopQuery.refetch()}
      style={[styles.screenContent, { paddingBottom: compact ? 20 : 28 }]}
      footer={
        <View style={[styles.stickyActions, compact && styles.stickyActionsCompact]}>
          <Pressable
            onPress={() =>
              void callPhone(workshop.phone).then((result) => {
                if (!result.ok) {
                  showError(result.title, result.message);
                }
              })
            }
            style={({ pressed }) => [
              styles.stickyCallButton,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Позвонить мастеру ${workshop.phone}`}
          >
            <Ionicons name="call" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={styles.stickyActionItem}>
            <AppButton
              label="Маршрут"
              icon="navigate"
              compact
              variant={hasCoordinates ? 'secondary' : 'ghost'}
              disabled={!hasCoordinates}
              onPress={() => {
                if (!hasCoordinates) {
                  return;
                }

                void openRoute(
                  workshop.latitude as number,
                  workshop.longitude as number,
                  workshop.title,
                ).then((result) => {
                  if (!result.ok) {
                    showError(result.title, result.message);
                  }
                });
              }}
            />
          </View>
          <View style={styles.stickyActionItem}>
            <AppButton
              label="Заявка"
              icon="document-text-outline"
              compact
              onPress={() =>
                router.push({ pathname: '/requests/create', params: { workshopId: workshop.id } })
              }
            />
          </View>
        </View>
      }
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, { paddingTop: topBarPaddingTop }]}>
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.topBarButton,
            {
              width: topBarButtonSize,
              height: topBarButtonSize,
              borderRadius: compact ? 14 : 16,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Назад"
        >
          <Ionicons name="chevron-back" size={compact ? 22 : 24} color={colors.text} />
        </Pressable>
        <Text style={[styles.topBarTitle, { fontSize: layout.font(18, 0.2, 16, 18) }]}>
          Карточка СТО
        </Text>
        <View style={{ width: topBarButtonSize, height: topBarButtonSize }} />
      </View>

      <View style={styles.hero}>
        <View style={styles.heroTitleRow}>
          <Text style={[styles.title, { fontSize: layout.font(28, 0.25, 24, 30) }]}>
            {workshop.title}
          </Text>
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
        contentContainerStyle={[
          styles.photoRail,
          { gap: compact ? 10 : 12, paddingRight: layout.gutter },
        ]}
      >
        {coverPhotos.length ? (
          coverPhotos.map((photo) => (
            <View
              key={photo.id}
              style={[
                styles.heroPhotoWrap,
                {
                  width: heroPhotoWidth,
                  height: heroPhotoHeight,
                  borderRadius: compact ? 20 : 24,
                },
              ]}
            >
              <Pressable
                onPress={() => setSelectedPhotoUrl(photo.url)}
                style={styles.heroPhotoOpenButton}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Увеличить фото ${workshop.title}`}
              >
                <Image
                  source={{ uri: photo.url }}
                  style={[
                    styles.heroPhoto,
                    {
                      width: heroPhotoWidth,
                      height: heroPhotoHeight,
                      borderRadius: compact ? 20 : 24,
                    },
                  ]}
                />
              </Pressable>
              <Pressable
                disabled={reportMutation.isPending}
                onPress={() =>
                  submitReport(ReportTargetType.PHOTO, photo.id, 'Проблема с фото')
                }
                style={styles.photoReportButton}
                accessibilityRole="button"
                accessibilityLabel="Пожаловаться на фото"
              >
                <Ionicons name="flag-outline" size={16} color={colors.accentDark} />
              </Pressable>
            </View>
          ))
        ) : (
          <View
            style={[
              styles.heroPhotoEmpty,
              {
                width: heroPhotoWidth,
                height: heroPhotoHeight,
                borderRadius: compact ? 20 : 24,
              },
            ]}
          >
            <Ionicons name="image-outline" size={28} color={colors.accentDark} />
            <Text style={styles.heroPhotoEmptyText}>Фото появятся после загрузки мастером</Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={Boolean(selectedPhotoUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhotoUrl(null)}
      >
        <View style={styles.photoModal}>
          <Pressable style={styles.photoModalBackdrop} onPress={() => setSelectedPhotoUrl(null)} />
          <View style={styles.photoModalContent}>
            <Pressable
              onPress={() => setSelectedPhotoUrl(null)}
              style={styles.photoModalCloseButton}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
            {selectedPhotoUrl ? (
              <Image
                source={{ uri: selectedPhotoUrl }}
                style={styles.photoModalImage}
                resizeMode="contain"
              />
            ) : null}
            <View
              style={[
                styles.photoModalContact,
                { bottom: Math.max(insets.bottom + 18, 28) },
              ]}
            >
              <View style={styles.photoModalContactCopy}>
                <Text style={styles.photoModalContactLabel}>Контакты мастера</Text>
                <Text
                  style={styles.photoModalContactPhone}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                >
                  {workshop.phone}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  void callPhone(workshop.phone).then((result) => {
                    if (!result.ok) {
                      showError(result.title, result.message);
                    }
                  })
                }
                style={styles.photoModalPhoneButton}
                accessibilityRole="button"
                accessibilityLabel={`Позвонить мастеру ${workshop.phone}`}
              >
                <Ionicons name="call" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={[styles.card, cardAdaptiveStyle]}>
        <Text style={styles.description}>{workshop.description}</Text>
        <View style={styles.contactCard}>
          <View style={styles.contactCopy}>
            <Text style={styles.contactLabel}>Контакты мастера</Text>
            <Text style={styles.contactPhone}>{workshop.phone}</Text>
          </View>
          <Pressable
            onPress={() =>
              void callPhone(workshop.phone).then((result) => {
                if (!result.ok) {
                  showError(result.title, result.message);
                }
              })
            }
            style={styles.phoneIconButton}
            accessibilityRole="button"
            accessibilityLabel={`Позвонить мастеру ${workshop.phone}`}
          >
            <Ionicons name="call" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
        <Text style={styles.meta}>График: {workshop.openingHours || 'Уточняйте по телефону'}</Text>
        <Text style={styles.meta}>
          Рейтинг {workshop.averageRating.toFixed(1)} • {formatReviewCount(workshop.reviewsCount)}
        </Text>
        {workshop.isVerifiedMaster ? (
          <Text style={styles.verifiedText}>
            Мастер проверен модератором MasterTop.
          </Text>
        ) : null}
      </View>

      <View style={[styles.card, cardAdaptiveStyle]}>
        <View style={[styles.locationHeader, compact && styles.locationHeaderStack]}>
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
              accessibilityRole="button"
              accessibilityLabel="Открыть карту мастерской"
            >
              <Ionicons name="location-outline" size={16} color={colors.accentDark} />
              <Text style={styles.locationChipText}>Открыть карту</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.meta}>
          {workshop.city}, {workshop.addressLine}
        </Text>

        {hasCoordinates && locationHtml ? (
          <>
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
              style={styles.locationMapPreview}
              accessibilityRole="button"
              accessibilityLabel="Открыть карту мастерской"
            >
              <WebView
                pointerEvents="none"
                originWhitelist={['*']}
                source={{ html: locationHtml }}
                style={styles.locationMap}
              />
            </Pressable>
            <Pressable
              onPress={() =>
                openRoute(
                  workshop.latitude as number,
                  workshop.longitude as number,
                  workshop.title,
                ).then((result) => {
                  if (!result.ok) {
                    showError(result.title, result.message);
                  }
                })
              }
              style={styles.routeButton}
              accessibilityRole="button"
              accessibilityLabel={`Построить маршрут до ${workshop.title}`}
            >
              <Ionicons name="navigate" size={18} color="#FFFFFF" />
              <Text style={styles.primaryText}>Построить маршрут</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.meta}>Точная точка на карте пока не указана.</Text>
        )}
      </View>

      <View style={[styles.card, cardAdaptiveStyle]}>
        <Text style={styles.sectionTitle}>Услуги и цены</Text>
        {workshop.services.map((service) => (
          <View key={service.id} style={[styles.serviceRow, compact && styles.serviceRowStack]}>
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

      <View style={[styles.actions, compact && styles.actionsStack]}>
        <Pressable
          disabled={favoriteMutation.isPending}
          onPress={() => favoriteMutation.mutate(!isFavorite)}
          style={({ pressed }) => [
            styles.secondaryButton,
            isFavorite && styles.favoriteButtonActive,
            pressed && !favoriteMutation.isPending && styles.buttonPressed,
            favoriteMutation.isPending && styles.disabledButton,
          ]}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
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
        disabled={reportMutation.isPending}
        onPress={() =>
          submitReport(ReportTargetType.WORKSHOP, workshop.id, 'Проблема с объявлением')
        }
        style={styles.reportButton}
        accessibilityRole="button"
        accessibilityLabel="Пожаловаться на объявление"
      >
        <Ionicons name="flag-outline" size={18} color={colors.accentDark} />
        <Text style={styles.reportButtonText}>
          {reportMutation.isPending ? 'Отправляем жалобу...' : 'Пожаловаться на объявление'}
        </Text>
      </Pressable>

      {reportNotice ? <Text style={styles.reportNotice}>{reportNotice}</Text> : null}

      <View style={[styles.card, styles.reviewsCard, cardAdaptiveStyle]}>
        <View style={styles.reviewsTop}>
          <View style={styles.reviewsTitleWrap}>
            <Text style={styles.sectionTitle}>Отзывы клиентов</Text>
            <Text style={styles.reviewsSubtitle}>
              {reviewStats.total
                ? formatClientReviewCount(reviewStats.total)
                : 'Пока без оценок'}
            </Text>
          </View>
          <View style={styles.ratingSummaryBadge}>
            <Ionicons name="star" size={18} color="#FFFFFF" />
            <Text style={styles.ratingSummaryValue}>{reviewStats.average.toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.ratingOverview}>
          <View style={styles.ratingScorePanel}>
            <Text style={styles.ratingScore}>{reviewStats.average.toFixed(1)}</Text>
            <InlineStars rating={reviewStats.average} size={16} />
            <Text style={styles.ratingScoreCaption}>{formatReviewCount(reviewStats.total)}</Text>
          </View>
          <View style={styles.ratingBars}>
            {reviewStats.distribution.map((item) => (
              <View key={item.rating} style={styles.ratingBarRow}>
                <Text style={styles.ratingBarLabel}>{item.rating}</Text>
                <View style={styles.ratingBarTrack}>
                  <View style={[styles.ratingBarFill, { width: `${item.percent}%` }]} />
                </View>
                <Text style={styles.ratingBarCount}>{item.count}</Text>
              </View>
            ))}
          </View>
        </View>

        {canReview ? (
          <View style={styles.reviewComposer}>
            <View style={styles.reviewComposerHeader}>
              <View style={styles.reviewComposerIcon}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.accentDark} />
              </View>
              <View style={styles.reviewComposerCopy}>
                <Text style={styles.reviewComposerTitle}>Оставить отзыв</Text>
                <Text style={styles.reviewComposerSubtitle}>
                  Рейтинг обновится сразу после отправки.
                </Text>
              </View>
            </View>

            <View style={styles.ratingRow}>
              {ratingValues.map((value) => {
                const active = value <= reviewRating;
                const selected = value === reviewRating;

                return (
                  <AnimatedRatingStar
                    key={value}
                    value={value}
                    active={active}
                    selected={selected}
                    onPress={() => {
                      setReviewNotice(null);
                      setReviewRating(value);
                      void triggerImpact();
                    }}
                  />
                );
              })}
            </View>
            <View style={styles.ratingChoiceLine}>
              <Text style={styles.ratingChoiceText}>
                {reviewRating}/5 • {getRatingCaption(reviewRating)}
              </Text>
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
              maxLength={360}
            />
            <Text style={styles.reviewCounter}>{reviewComment.length}/360</Text>

            {reviewNotice ? <Text style={styles.reviewNotice}>{reviewNotice}</Text> : null}

            <Pressable
              disabled={!canSubmitReview}
              onPress={() => reviewMutation.mutate()}
              style={[
                styles.primaryButton,
                !canSubmitReview && styles.disabledButton,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Отправить отзыв"
            >
              <Text style={styles.primaryText}>
                {reviewMutation.isPending ? 'Отправляем отзыв...' : 'Отправить отзыв'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {workshop.reviews.length ? (
          <View style={styles.reviewsList}>
            {workshop.reviews.map((review, index) => (
              <ReviewCard
                key={review.id}
                review={review}
                index={index}
                disabled={reportMutation.isPending}
                onReport={() =>
                  submitReport(ReportTargetType.REVIEW, review.id, 'Проблема с отзывом')
                }
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyReviews}>
            <Ionicons name="sparkles-outline" size={22} color={colors.accentDark} />
            <View style={styles.emptyReviewsCopy}>
              <Text style={styles.emptyReviewsTitle}>Отзывов пока нет</Text>
              <Text style={styles.meta}>
                Первый отзыв поможет другим клиентам быстрее выбрать мастера.
              </Text>
            </View>
          </View>
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
    fontWeight: '800',
    color: colors.text,
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
  heroPhotoOpenButton: {
    flex: 1,
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
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#F5FBF8',
    borderWidth: 1,
    borderColor: '#CFE7DE',
  },
  contactCopy: {
    flex: 1,
    gap: 3,
  },
  contactLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  contactPhone: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  phoneIconButton: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
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
  locationHeaderStack: {
    alignItems: 'flex-start',
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
  locationMapPreview: {
    height: 190,
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F4EFE7',
  },
  locationMap: {
    flex: 1,
    backgroundColor: '#F4EFE7',
  },
  routeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: colors.success,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  serviceRowStack: {
    flexDirection: 'column',
    gap: 6,
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
  actionsStack: {
    flexDirection: 'column',
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
  reviewsCard: {
    overflow: 'hidden',
  },
  reviewsTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reviewsTitleWrap: {
    flex: 1,
    gap: 4,
  },
  reviewsSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  ratingSummaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.warning,
    shadowColor: colors.warning,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  ratingSummaryValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  ratingOverview: {
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    borderRadius: 20,
    backgroundColor: colors.surfaceWarning,
    borderWidth: 1,
    borderColor: colors.borderWarning,
  },
  ratingScorePanel: {
    width: 94,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  ratingScore: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
  },
  ratingScoreCaption: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  ratingBars: {
    flex: 1,
    gap: 7,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingBarLabel: {
    width: 10,
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  ratingBarTrack: {
    flex: 1,
    height: 8,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 253, 249, 0.78)',
  },
  ratingBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.warning,
  },
  ratingBarCount: {
    width: 20,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  inlineStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  review: {
    gap: 10,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reviewAuthorRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewAvatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.borderWarm,
  },
  reviewAvatarText: {
    color: colors.accentDark,
    fontSize: 14,
    fontWeight: '900',
  },
  reviewAuthorCopy: {
    flex: 1,
    gap: 3,
  },
  reviewDate: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  reviewRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.warning,
  },
  reviewRatingBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  reviewReportButton: {
    alignSelf: 'flex-start',
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
    padding: 14,
    borderRadius: 22,
    backgroundColor: colors.surfaceSuccess,
    borderWidth: 1,
    borderColor: colors.borderSuccess,
  },
  reviewComposerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewComposerIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderSuccess,
  },
  reviewComposerCopy: {
    flex: 1,
    gap: 3,
  },
  reviewComposerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  reviewComposerSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  ratingStarButton: {
    flex: 1,
    maxWidth: 54,
    minHeight: 48,
    aspectRatio: 1,
    overflow: 'hidden',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderWarning,
  },
  ratingStarButtonActive: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  ratingStarGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  ratingChoiceLine: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderSuccess,
  },
  ratingChoiceText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '900',
  },
  reviewCounter: {
    alignSelf: 'flex-end',
    marginTop: -8,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  reviewNotice: {
    color: colors.success,
    lineHeight: 20,
    fontWeight: '800',
  },
  reviewsList: {
    gap: 10,
  },
  emptyReviews: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.borderWarm,
  },
  emptyReviewsCopy: {
    flex: 1,
    gap: 3,
  },
  emptyReviewsTitle: {
    color: colors.text,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.55,
  },
  photoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  photoModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  photoModalContent: {
    flex: 1,
    padding: 18,
    justifyContent: 'center',
  },
  photoModalCloseButton: {
    position: 'absolute',
    top: 54,
    right: 18,
    zIndex: 2,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  photoModalImage: {
    width: '100%',
    height: '100%',
  },
  photoModalContact: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
  },
  photoModalContactCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  photoModalContactLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  photoModalContactPhone: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  photoModalPhoneButton: {
    width: 54,
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  stickyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stickyActionsCompact: {
    gap: 8,
  },
  stickyActionItem: {
    flex: 1,
  },
  stickyCallButton: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
});
