import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { PaginatedResult, ServiceCategory, WorkshopSummary } from '@stomvp/shared';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { getCategoryIcon } from '../../src/constants/category-meta';
import { colors } from '../../src/constants/theme';
import { createWorkshopsLeafletHtml } from '../../src/utils/leaflet-html';
import { getDefaultMapCoordinates } from '../../src/utils/maps';

const filterPalettes = [
  { background: '#FFF1E7', badge: '#FFE3D0', border: '#F1D1BC', icon: colors.accentDark },
  { background: '#EAF4F1', badge: '#D7ECE5', border: '#C8E0D8', icon: colors.success },
  { background: '#FFF7DD', badge: '#FFECB2', border: '#EEDDAB', icon: colors.warning },
  { background: '#EEF2FF', badge: '#DCE4FF', border: '#CFD9FA', icon: '#4862C5' },
];

type MapMessage =
  | {
      type: 'ready';
    }
  | {
      type: 'select-workshop';
      workshopId: string;
    }
  | {
      type: 'deselect-workshop';
    };

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function MapTabScreen() {
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<Coordinates | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const deferredCity = useDeferredValue(city);
  const fallbackCenter = useMemo(() => getDefaultMapCoordinates(), []);

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<ServiceCategory[]>('/categories');
      return data;
    },
  });

  const workshopsQuery = useQuery({
    queryKey: ['workshops-map', deferredSearch, deferredCity, categoryId],
    queryFn: async () => {
      const allItems: WorkshopSummary[] = [];
      let page = 1;
      let pageCount = 1;

      do {
        const { data } = await api.get<PaginatedResult<WorkshopSummary>>('/workshops', {
          params: {
            page,
            pageSize: 50,
            search: deferredSearch || undefined,
            city: deferredCity || undefined,
            categoryId,
          },
        });

        allItems.push(...data.data);
        pageCount = data.meta.pageCount;
        page += 1;
      } while (page <= pageCount);

      return allItems;
    },
  });

  const categories = categoriesQuery.data ?? [];
  const workshops = workshopsQuery.data ?? [];
  const mapWorkshops = useMemo(
    () => workshops.filter((workshop) => workshop.latitude != null && workshop.longitude != null),
    [workshops],
  );

  useEffect(() => {
    if (selectedWorkshopId && !mapWorkshops.some((workshop) => workshop.id === selectedWorkshopId)) {
      setSelectedWorkshopId(null);
    }
  }, [mapWorkshops, selectedWorkshopId]);

  useEffect(() => {
    if (!selectedWorkshopId && mapWorkshops.length === 1) {
      setSelectedWorkshopId(mapWorkshops[0].id);
    }
  }, [mapWorkshops, selectedWorkshopId]);

  useEffect(() => {
    if (deferredSearch || deferredCity || categoryId) {
      setMapCenter(null);
    }
  }, [categoryId, deferredCity, deferredSearch]);

  const resolveDeviceLocation = async ({
    forceCenter,
    silent,
  }: {
    forceCenter: boolean;
    silent?: boolean;
  }) => {
    try {
      setIsLocating(true);

      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (permission.status !== Location.PermissionStatus.GRANTED) {
        if (forceCenter && !mapCenter) {
          setMapCenter(fallbackCenter);
        }

        if (!silent) {
          Alert.alert(
            'Нет доступа к геопозиции',
            'Разрешите доступ к локации, чтобы показывать ваше место на карте.',
          );
        }
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const nextLocation = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };

      setDeviceLocation(nextLocation);

      if (forceCenter || !mapCenter) {
        setMapCenter(nextLocation);
      }
    } catch {
      if (!silent) {
        Alert.alert(
          'Не удалось определить геопозицию',
          'Проверьте доступ к геолокации и попробуйте ещё раз.',
        );
      }
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    void resolveDeviceLocation({ forceCenter: true, silent: true });
  }, []);

  const selectedWorkshop = useMemo(
    () => mapWorkshops.find((workshop) => workshop.id === selectedWorkshopId) ?? null,
    [mapWorkshops, selectedWorkshopId],
  );

  const html = useMemo(
    () =>
      createWorkshopsLeafletHtml({
        workshops: mapWorkshops.map((workshop) => ({
          id: workshop.id,
          title: workshop.title,
          address: `${workshop.city}, ${workshop.addressLine}`,
          latitude: workshop.latitude as number,
          longitude: workshop.longitude as number,
          rating: workshop.averageRating,
        })),
        center: mapCenter,
        userLocation: deviceLocation,
      }),
    [deviceLocation, mapCenter, mapWorkshops],
  );

  const refresh = () => {
    void Promise.all([workshopsQuery.refetch(), categoriesQuery.refetch()]);
  };

  return (
    <Screen edges={['left', 'right', 'bottom']} scroll={false} style={styles.screenContent}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Карта объявлений</Text>
          <Text style={styles.subtitle}>
            Ищите мастеров по карте, городу и нужной услуге. Можно сразу перейти в карточку.
          </Text>
        </View>

        <Pressable onPress={refresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={18} color={colors.accentDark} />
        </Pressable>
      </View>

      <View style={styles.inputsRow}>
        <View style={styles.inputShell}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            placeholder="Что ищем"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            style={styles.input}
          />
        </View>

        <View style={styles.inputShell}>
          <Ionicons name="business-outline" size={18} color={colors.muted} />
          <TextInput
            placeholder="Город"
            placeholderTextColor={colors.muted}
            value={city}
            onChangeText={setCity}
            style={styles.input}
          />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRail}
      >
        <Pressable
          onPress={() => setCategoryId(undefined)}
          style={[
            styles.filterCard,
            !categoryId ? styles.filterCardSelectedFilled : styles.filterCardAll,
            !categoryId && styles.filterCardSelected,
            !categoryId && styles.filterCardActive,
          ]}
        >
          <View
            style={[
              styles.filterIconWrap,
              !categoryId ? styles.filterIconWrapActive : styles.filterIconWrapWarm,
            ]}
          >
            <Ionicons
              name="grid-outline"
              size={18}
              color={!categoryId ? '#FFFFFF' : colors.accentDark}
            />
          </View>
          <Text style={[styles.filterTitle, !categoryId && styles.filterTitleActive]}>Все</Text>
        </Pressable>

        {categories.map((category, index) => {
          const palette = filterPalettes[index % filterPalettes.length];
          const active = categoryId === category.id;

          return (
            <Pressable
              key={category.id}
              onPress={() => setCategoryId(active ? undefined : category.id)}
              style={[
                styles.filterCard,
                {
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
                    backgroundColor: active ? 'rgba(255, 255, 255, 0.18)' : palette.badge,
                  },
                ]}
              >
                <Ionicons
                  name={getCategoryIcon(category.slug)}
                  size={18}
                  color={active ? '#FFFFFF' : palette.icon}
                />
              </View>
              <Text
                numberOfLines={2}
                style={[styles.filterTitle, active && styles.filterTitleActive]}
              >
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          На карте: {mapWorkshops.length} точек из {workshops.length} опубликованных объявлений
        </Text>
      </View>

      <View style={styles.mapCard}>
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={styles.map}
          onMessage={(event) => {
            try {
              const payload = JSON.parse(event.nativeEvent.data) as MapMessage;

              if (payload.type === 'select-workshop') {
                setSelectedWorkshopId(payload.workshopId);
                return;
              }

              if (payload.type === 'deselect-workshop') {
                setSelectedWorkshopId(null);
              }
            } catch {
              return;
            }
          }}
        />

        <Pressable
          onPress={() => void resolveDeviceLocation({ forceCenter: true })}
          style={styles.locateButton}
        >
          {isLocating ? (
            <ActivityIndicator color={colors.accentDark} size="small" />
          ) : (
            <Ionicons name="locate-outline" size={20} color={colors.accentDark} />
          )}
        </Pressable>

        {selectedWorkshop ? (
          <View style={styles.previewOverlay}>
            <View style={styles.previewRow}>
              <View style={styles.previewThumb}>
                {selectedWorkshop.photos[0] ? (
                  <Image
                    source={{ uri: selectedWorkshop.photos[0].url }}
                    style={styles.previewImage}
                  />
                ) : (
                  <View style={styles.previewPlaceholder}>
                    <Ionicons name="car-sport-outline" size={20} color={colors.accentDark} />
                  </View>
                )}
              </View>

              <View style={styles.previewCopy}>
                <Text numberOfLines={1} style={styles.previewTitle}>
                  {selectedWorkshop.title}
                </Text>
                <Text numberOfLines={2} style={styles.previewSubtitle}>
                  {selectedWorkshop.city}, {selectedWorkshop.addressLine}
                </Text>
                <Text style={styles.previewMeta}>
                  Рейтинг {selectedWorkshop.averageRating.toFixed(1)} •{' '}
                  {selectedWorkshop.categories.slice(0, 2).map((item) => item.name).join(', ') ||
                    'Без категории'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => router.push(`/workshop/${selectedWorkshop.id}`)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryText}>Открыть объявление</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  headerCopy: {
    flex: 1,
    gap: 6,
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
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0E5',
    borderWidth: 1,
    borderColor: '#F1D1BC',
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputShell: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  filterRail: {
    gap: 10,
    paddingRight: 16,
  },
  filterCard: {
    width: 104,
    minHeight: 74,
    padding: 12,
    borderRadius: 20,
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterCardAll: {
    backgroundColor: '#FFF8F2',
    borderColor: '#F1D1BC',
  },
  filterCardSelectedFilled: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterCardSelected: {
    shadowColor: '#151515',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  filterCardActive: {
    transform: [{ translateY: -1 }],
  },
  filterIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIconWrapWarm: {
    backgroundColor: '#FFE3D0',
  },
  filterIconWrapActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  filterTitleActive: {
    color: '#FFFFFF',
  },
  metaRow: {
    paddingHorizontal: 4,
  },
  metaText: {
    color: colors.muted,
    fontSize: 13,
  },
  mapCard: {
    flex: 1,
    minHeight: 420,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  map: {
    flex: 1,
    backgroundColor: colors.background,
  },
  locateButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 253, 249, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(24, 33, 32, 0.08)',
  },
  previewOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    padding: 12,
    gap: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 253, 249, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(24, 33, 32, 0.08)',
  },
  previewRow: {
    flexDirection: 'row',
    gap: 12,
  },
  previewThumb: {
    width: 76,
    height: 76,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFF1E7',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCopy: {
    flex: 1,
    gap: 4,
  },
  previewTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  previewSubtitle: {
    color: colors.muted,
    lineHeight: 18,
  },
  previewMeta: {
    color: colors.accentDark,
    fontWeight: '700',
    fontSize: 12,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
