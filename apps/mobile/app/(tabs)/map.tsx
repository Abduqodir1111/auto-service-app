import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { PaginatedResult, ServiceCategory, WorkshopSummary } from '@stomvp/shared';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { getCategoryIcon } from '../../src/constants/category-meta';
import { colors } from '../../src/constants/theme';
import { getDeviceCoordinates } from '../../src/utils/device-location';
import { createWorkshopsLeafletHtml } from '../../src/utils/leaflet-html';
import { getDefaultMapCoordinates } from '../../src/utils/maps';

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
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<Coordinates | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const filterRailRef = useRef<ScrollView>(null);
  const fallbackCenter = useMemo(() => getDefaultMapCoordinates(), []);

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<ServiceCategory[]>('/categories');
      return data;
    },
  });

  const workshopsQuery = useQuery({
    queryKey: ['workshops-map', categoryId],
    queryFn: async () => {
      const allItems: WorkshopSummary[] = [];
      let page = 1;
      let pageCount = 1;

      do {
        const { data } = await api.get<PaginatedResult<WorkshopSummary>>('/workshops', {
          params: {
            page,
            pageSize: 50,
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
    if (categoryId) {
      setMapCenter(null);
    }
  }, [categoryId]);

  useEffect(() => {
    if (categoryId || categories.length === 0) {
      return;
    }

    requestAnimationFrame(() => {
      filterRailRef.current?.scrollTo({ x: 0, animated: false });
    });
  }, [categories.length, categoryId]);

  const resolveDeviceLocation = async ({
    forceCenter,
    silent,
  }: {
    forceCenter: boolean;
    silent?: boolean;
  }) => {
    try {
      setIsLocating(true);

      const result = await getDeviceCoordinates(fallbackCenter);

      if (!result.coordinates) {
        if (forceCenter && !mapCenter) {
          setMapCenter(fallbackCenter);
        }

        if (!silent && result.permissionDenied) {
          Alert.alert(
            'Нет доступа к геопозиции',
            'Разрешите доступ к локации, чтобы показывать ваше место на карте.',
          );
        }
        return;
      }
      const nextLocation = result.coordinates;

      setDeviceLocation(nextLocation);

      if (forceCenter || !mapCenter) {
        setMapCenter(nextLocation);
      }
    } catch {
      if (forceCenter && !mapCenter) {
        setMapCenter(fallbackCenter);
      }

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

  return (
    <Screen scroll={false} style={styles.screenContent}>
      <ScrollView
        ref={filterRailRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRailWrap}
        contentContainerStyle={styles.filterRail}
      >
        <Pressable
          onPress={() => setCategoryId(undefined)}
          style={[styles.chip, !categoryId && styles.chipActive]}
        >
          <Ionicons
            name="grid-outline"
            size={14}
            color={!categoryId ? '#FFFFFF' : colors.accentDark}
          />
          <Text style={[styles.chipText, !categoryId && styles.chipTextActive]}>Все</Text>
        </Pressable>

        {categories.map((category) => {
          const active = categoryId === category.id;
          return (
            <Pressable
              key={category.id}
              onPress={() => setCategoryId(active ? undefined : category.id)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Ionicons
                name={getCategoryIcon(category.slug)}
                size={14}
                color={active ? '#FFFFFF' : colors.accentDark}
              />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

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
                {selectedWorkshop.isVerifiedMaster ? (
                  <View style={styles.previewVerified}>
                    <Ionicons name="shield-checkmark" size={12} color="#FFFFFF" />
                    <Text style={styles.previewVerifiedText}>Проверенный мастер</Text>
                  </View>
                ) : null}
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
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  filterRailWrap: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterRail: {
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  mapCard: {
    flex: 1,
    borderRadius: 24,
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
  previewVerified: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  previewVerifiedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
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
