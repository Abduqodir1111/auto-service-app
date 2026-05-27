import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ServiceCategory, UserRole, WorkshopSummary } from '@stomvp/shared';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CallMasterFab } from '../../components/call-master-fab';
import { CallStatusBanner } from '../../components/call-status-banner';
import { Screen } from '../../components/screen';
import { WorkshopCardSkeleton } from '../../components/skeleton';
import { WorkshopCard } from '../../components/workshop-card';
import { api } from '../../src/api/client';
import { getCategoryIcon } from '../../src/constants/category-meta';
import { colors } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/auth-store';
import { type Coordinates, getDeviceCoordinates } from '../../src/utils/device-location';
import { syncFavoriteCaches } from '../../src/utils/favorites-cache';
import { useResponsive } from '../../src/utils/responsive';

// Tashkent center as a sensible default before we know where the user is.
const TASHKENT_CENTER: Coordinates = {
  latitude: 41.2995,
  longitude: 69.2401,
};
const CATALOG_RADIUS_METERS = 50_000;

const filterPalettes = [
  { background: '#FFF1E7', badge: '#FFE3D0', border: '#F1D1BC', icon: colors.accentDark },
  { background: '#EAF4F1', badge: '#D7ECE5', border: '#C8E0D8', icon: colors.success },
  { background: '#FFF7DD', badge: '#FFECB2', border: '#EEDDAB', icon: colors.warning },
  { background: '#EEF2FF', badge: '#DCE4FF', border: '#CFD9FA', icon: '#4862C5' },
];

export default function CatalogScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchAnimation = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);
  const filterRailRef = useRef<ScrollView>(null);
  const layout = useResponsive();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((state) => state.session?.user.role);

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<ServiceCategory[]>('/categories');
      return data;
    },
  });

  const [userCoords, setUserCoords] = useState<Coordinates | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getDeviceCoordinates(TASHKENT_CENTER);
      if (!cancelled) {
        setUserCoords(result.coordinates);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Round the coords used in the query key so tiny GPS jitter (a few metres)
  // doesn't trigger a refetch on every render. ~3 decimals ≈ 100 m precision.
  const roundedLat = userCoords ? Math.round(userCoords.latitude * 1000) / 1000 : null;
  const roundedLng = userCoords ? Math.round(userCoords.longitude * 1000) / 1000 : null;

  const workshopsQuery = useQuery({
    queryKey: ['workshops', search, categoryId, roundedLat, roundedLng],
    queryFn: async () => {
      const { data } = await api.get<{ data: WorkshopSummary[] }>('/workshops', {
        params: {
          search: search || undefined,
          categoryId,
          lat: userCoords?.latitude,
          lng: userCoords?.longitude,
          radius: userCoords ? CATALOG_RADIUS_METERS : undefined,
        },
      });
      return data.data;
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (workshop: WorkshopSummary) => {
      const nextIsFavorite = !workshop.isFavorite;

      if (nextIsFavorite) {
        await api.post(`/favorites/${workshop.id}`);
        return nextIsFavorite;
      }

      await api.delete(`/favorites/${workshop.id}`);
      return nextIsFavorite;
    },
    onMutate: async (workshop) => {
      const nextIsFavorite = !workshop.isFavorite;
      const rollback = syncFavoriteCaches(queryClient, workshop, nextIsFavorite);
      return { rollback };
    },
    onError: (_error, workshop, context) => {
      context?.rollback?.();
      Alert.alert(
        'Не удалось обновить избранное',
        workshop.isFavorite
          ? 'Не получилось убрать объявление из избранного. Попробуйте ещё раз.'
          : 'Не получилось добавить объявление в избранное. Попробуйте ещё раз.',
      );
    },
    onSuccess: async (_nextIsFavorite, workshop) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['favorites'] }),
        queryClient.invalidateQueries({ queryKey: ['workshops'] }),
        queryClient.invalidateQueries({ queryKey: ['workshop', workshop.id] }),
      ]);
    },
  });

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const searchButtonSize = layout.isSmallPhone ? 44 : 48;
  const expandedSearchWidth = Math.min(layout.contentWidth, layout.isTablet ? 480 : 420);
  const topSpacing = Math.max(insets.top - layout.verticalScale(28), layout.isSmallPhone ? 2 : 6);
  const filterCardWidth = layout.isSmallPhone ? 88 : layout.isTablet ? 112 : 96;
  const filterCardHeight = layout.isSmallPhone ? 96 : layout.isTablet ? 118 : 108;
  const filterIconSize = layout.isSmallPhone ? 40 : 46;
  const searchWidth = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [searchButtonSize, expandedSearchWidth],
  });

  useEffect(() => {
    Animated.timing(searchAnimation, {
      toValue: searchExpanded ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }

      if (searchExpanded) {
        searchInputRef.current?.focus();
        return;
      }

      searchInputRef.current?.blur();
      Keyboard.dismiss();
    });
  }, [searchAnimation, searchExpanded]);

  useEffect(() => {
    if (categoryId || categories.length === 0) {
      return;
    }

    requestAnimationFrame(() => {
      filterRailRef.current?.scrollTo({ x: 0, animated: false });
    });
  }, [categories.length, categoryId]);

  const closeSearch = () => {
    setSearch('');
    setSearchExpanded(false);
  };

  return (
    <Screen
      scroll={false}
      edges={['left', 'right', 'bottom']}
      style={[
        styles.screenContent,
        {
          paddingTop: topSpacing,
          paddingHorizontal: layout.gutter,
          gap: layout.isSmallPhone ? 10 : 12,
        },
      ]}
    >
      <View style={styles.stickyHead}>
        <View style={styles.toolbar}>
          <Animated.View
            style={[
              styles.searchShell,
              {
                width: searchWidth,
                height: searchButtonSize,
                borderRadius: searchButtonSize / 2,
              },
            ]}
          >
            {searchExpanded ? (
              <TextInput
                ref={searchInputRef}
                placeholder="Поиск сервисов"
                placeholderTextColor={colors.muted}
                style={[styles.searchInput, { fontSize: layout.font(15, 0.25, 14, 16) }]}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
                selectionColor={colors.accent}
              />
            ) : null}
            <Pressable
              onPress={searchExpanded ? closeSearch : () => setSearchExpanded(true)}
              style={[styles.searchButton, { width: searchButtonSize, height: searchButtonSize }]}
            >
              <Ionicons
                name={searchExpanded ? 'close' : 'search'}
                size={layout.isSmallPhone ? 19 : 20}
                color={searchExpanded ? colors.accentDark : colors.text}
              />
            </Pressable>
          </Animated.View>
        </View>

        <CallStatusBanner />

        <ScrollView
          ref={filterRailRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRailWrap}
          contentContainerStyle={[
            styles.filterRail,
            {
              gap: layout.isSmallPhone ? 8 : 10,
              paddingRight: layout.gutter,
            },
          ]}
        >
          <Pressable
            onPress={() => setCategoryId(undefined)}
            style={[
              styles.filterCard,
              {
                width: filterCardWidth,
                height: filterCardHeight,
                borderRadius: layout.isSmallPhone ? 20 : 22,
                paddingVertical: layout.isSmallPhone ? 12 : 14,
                gap: layout.isSmallPhone ? 8 : 10,
              },
              styles.filterCardAll,
              !categoryId && styles.filterCardSelected,
              !categoryId && styles.filterCardActive,
            ]}
          >
            <View
              style={[
                styles.filterIconWrap,
                {
                  width: filterIconSize,
                  height: filterIconSize,
                  borderRadius: filterIconSize / 2,
                },
                styles.filterIconWrapWarm,
                !categoryId && styles.filterIconWrapActive,
              ]}
            >
              <Ionicons
                name="grid-outline"
                size={layout.isSmallPhone ? 21 : 24}
                color={!categoryId ? '#FFFFFF' : colors.accentDark}
              />
            </View>
            <Text
              style={[
                styles.filterTitle,
                { fontSize: layout.font(12, 0.2, 11, 13) },
                !categoryId && styles.filterTitleActive,
              ]}
            >
              Все услуги
            </Text>
          </Pressable>

          {categories.map((category, index) => {
            const palette = filterPalettes[index % filterPalettes.length];
            const active = categoryId === category.id;

            return (
              <Pressable
                key={category.id}
                onPress={() => setCategoryId(category.id)}
                style={[
                  styles.filterCard,
                  {
                    width: filterCardWidth,
                    height: filterCardHeight,
                    borderRadius: layout.isSmallPhone ? 20 : 22,
                    paddingVertical: layout.isSmallPhone ? 12 : 14,
                    gap: layout.isSmallPhone ? 8 : 10,
                    backgroundColor: active ? colors.accent : palette.background,
                    borderColor: active ? colors.accent : palette.border,
                  },
                  active && styles.filterCardActive,
                ]}
              >
                <View
                  style={[
                    styles.filterIconWrap,
                    {
                      width: filterIconSize,
                      height: filterIconSize,
                      borderRadius: filterIconSize / 2,
                      backgroundColor: active ? 'rgba(255, 255, 255, 0.18)' : palette.badge,
                    },
                  ]}
                >
                  <Ionicons
                    name={getCategoryIcon(category.slug)}
                    size={layout.isSmallPhone ? 21 : 24}
                    color={active ? '#FFFFFF' : palette.icon}
                  />
                </View>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.filterTitle,
                    { fontSize: layout.font(12, 0.2, 11, 13) },
                    active && styles.filterTitleActive,
                  ]}
                >
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={[
          styles.list,
          {
            gap: layout.isSmallPhone ? 12 : 14,
            paddingBottom: layout.isSmallPhone ? 96 : 120,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            colors={[colors.accent]}
            tintColor={colors.accent}
            refreshing={workshopsQuery.isRefetching || categoriesQuery.isRefetching}
            onRefresh={() => {
              void Promise.all([workshopsQuery.refetch(), categoriesQuery.refetch()]);
            }}
          />
        }
      >
        {workshopsQuery.isLoading ? (
          <>
            <WorkshopCardSkeleton />
            <WorkshopCardSkeleton />
            <WorkshopCardSkeleton />
          </>
        ) : (workshopsQuery.data ?? []).length ? (
          (workshopsQuery.data ?? []).map((workshop) => (
            <WorkshopCard
              key={workshop.id}
              workshop={workshop}
              favoriteAction={{
                label: workshop.isFavorite ? 'Убрать' : 'В избранное',
                isDanger: Boolean(workshop.isFavorite),
                disabled:
                  toggleFavoriteMutation.isPending &&
                  toggleFavoriteMutation.variables?.id === workshop.id,
                onPress: () => toggleFavoriteMutation.mutate(workshop),
              }}
            />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Пока нет опубликованных карточек</Text>
            <Text style={styles.emptyText}>
              Потяните экран вниз, чтобы заново проверить каталог после модерации или публикации.
            </Text>
          </View>
        )}
      </ScrollView>

      <CallMasterFab />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 0,
    gap: 12,
  },
  stickyHead: {
    gap: 12,
  },
  filterRailWrap: {
    flexGrow: 0,
    flexShrink: 0,
  },
  listScroll: {
    flex: 1,
  },
  list: {
    gap: 14,
    paddingTop: 6,
    paddingBottom: 120,
  },
  toolbar: {
    width: '100%',
    alignItems: 'flex-end',
  },
  searchShell: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 15,
  },
  searchButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRail: {
    gap: 10,
    paddingRight: 16,
    paddingVertical: 4,
  },
  filterCard: {
    width: 96,
    height: 108,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#1A1410',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 2,
  },
  filterCardAll: {
    backgroundColor: '#FFF7EE',
    borderColor: '#F2D7C3',
  },
  filterCardSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterCardActive: {
    transform: [{ translateY: -2 }],
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  filterIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIconWrapWarm: {
    backgroundColor: '#FFE3D0',
  },
  filterIconWrapActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  filterTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  filterTitleActive: {
    color: '#FFFFFF',
  },
  emptyCard: {
    padding: 22,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 20,
  },
});
