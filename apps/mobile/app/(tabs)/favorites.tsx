import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { WorkshopSummary } from '@stomvp/shared';
import { Screen } from '../../components/screen';
import { WorkshopCardSkeleton } from '../../components/skeleton';
import { EmptyState, NetworkBanner, RetryState } from '../../components/ui';
import { WorkshopCard } from '../../components/workshop-card';
import { api } from '../../src/api/client';
import { colors, radius, spacing, typography } from '../../src/constants/theme';
import { syncFavoriteCaches } from '../../src/utils/favorites-cache';
import { useResponsive } from '../../src/utils/responsive';

type FavoriteSort = 'recent' | 'rating' | 'popular' | 'name';

const sortOptions: Array<{ value: FavoriteSort; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'recent', label: 'Новые', icon: 'time-outline' },
  { value: 'rating', label: 'Рейтинг', icon: 'star-outline' },
  { value: 'popular', label: 'Популярные', icon: 'heart-outline' },
  { value: 'name', label: 'А-Я', icon: 'text-outline' },
];

function sortFavorites(items: WorkshopSummary[], sort: FavoriteSort) {
  return [...items].sort((left, right) => {
    if (sort === 'rating') {
      return right.averageRating - left.averageRating;
    }

    if (sort === 'popular') {
      return right.favoritesCount - left.favoritesCount;
    }

    if (sort === 'name') {
      return left.title.localeCompare(right.title, 'ru');
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export default function FavoritesScreen() {
  const queryClient = useQueryClient();
  const layout = useResponsive();
  const compact = layout.isSmallPhone;
  const [sort, setSort] = useState<FavoriteSort>('recent');

  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const { data } = await api.get<WorkshopSummary[]>('/favorites');
      return data;
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: async (workshop: WorkshopSummary) => {
      await api.delete(`/favorites/${workshop.id}`);
    },
    onMutate: async (workshop) => {
      const rollback = syncFavoriteCaches(queryClient, workshop, false);
      return { rollback };
    },
    onError: (_error, _workshop, context) => {
      context?.rollback?.();
      Alert.alert('Не удалось удалить из избранного', 'Попробуйте ещё раз.');
    },
    onSuccess: async (_data, workshop) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['favorites'] }),
        queryClient.invalidateQueries({ queryKey: ['workshop', workshop.id] }),
        queryClient.invalidateQueries({ queryKey: ['workshops'] }),
      ]);
    },
  });

  const favorites = useMemo(
    () => sortFavorites(favoritesQuery.data ?? [], sort),
    [favoritesQuery.data, sort],
  );

  return (
    <Screen
      edges={['top', 'left', 'right']}
      refreshing={favoritesQuery.isRefetching}
      onRefresh={() => void favoritesQuery.refetch()}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="heart" size={22} color="#FFFFFF" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { fontSize: layout.font(28, 0.25, 24, 30) }]}>
            Избранное
          </Text>
          <Text style={styles.subtitle}>
            Быстрый доступ к мастерским, которые вы сохранили для ремонта или сравнения.
          </Text>
        </View>
      </View>

      {favoritesQuery.isError ? <NetworkBanner /> : null}

      <View style={styles.sortRail}>
        {sortOptions.map((option) => {
          const active = sort === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => setSort(option.value)}
              style={({ pressed }) => [
                styles.sortChip,
                {
                  paddingHorizontal: compact ? 10 : 12,
                  paddingVertical: compact ? 8 : 9,
                },
                active && styles.sortChipActive,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons
                name={option.icon}
                size={15}
                color={active ? '#FFFFFF' : colors.accentDark}
              />
              <Text style={[styles.sortText, active && styles.sortTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {favoritesQuery.isLoading ? (
        <>
          <WorkshopCardSkeleton />
          <WorkshopCardSkeleton />
        </>
      ) : favoritesQuery.isError ? (
        <RetryState
          onRetry={() => void favoritesQuery.refetch()}
          loading={favoritesQuery.isRefetching}
        />
      ) : favorites.length ? (
        <View style={[styles.list, { gap: compact ? 12 : 14 }]}>
          {favorites.map((workshop) => (
            <WorkshopCard
              key={workshop.id}
              workshop={workshop}
              favoriteAction={{
                label: 'Убрать',
                isDanger: true,
                disabled:
                  removeFavoriteMutation.isPending &&
                  removeFavoriteMutation.variables?.id === workshop.id,
                onPress: () => removeFavoriteMutation.mutate(workshop),
              }}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="heart-outline"
          title="Избранных мастерских пока нет"
          text="Сохраняйте подходящие СТО из ленты, чтобы быстро вернуться к ним перед звонком или заявкой."
          actionLabel="Найти мастеров"
          onAction={() => router.push('/(tabs)')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.muted,
  },
  sortRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#F1D1BC',
    backgroundColor: '#FFF0E5',
  },
  sortChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  sortText: {
    color: colors.accentDark,
    fontWeight: '800',
    fontSize: 12,
  },
  sortTextActive: {
    color: '#FFFFFF',
  },
  list: {
    gap: 14,
  },
  buttonPressed: {
    opacity: 0.9,
  },
});
