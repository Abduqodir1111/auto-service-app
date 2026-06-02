import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { NetworkBanner } from '../../components/ui';
import { api } from '../../src/api/client';
import { getCategoryIcon } from '../../src/constants/category-meta';
import { colors } from '../../src/constants/theme';
import { showError, showWarning } from '../../src/store/feedback-store';
import { getDeviceCoordinates } from '../../src/utils/device-location';
import { createWorkshopsLeafletHtml } from '../../src/utils/leaflet-html';
import { callPhone, openRoute } from '../../src/utils/linking-actions';
import { getDefaultMapCoordinates } from '../../src/utils/maps';
import { useResponsive } from '../../src/utils/responsive';

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

const MAX_MAP_WORKSHOPS = 500;
const NEARBY_RADIUS_METERS = 50_000;

type WorkshopsMapResult = {
  items: WorkshopSummary[];
  limitReached: boolean;
};

function getDistanceMeters(from: Coordinates, to: Coordinates) {
  const earthRadiusMeters = 6_371_000;
  const fromLat = (from.latitude * Math.PI) / 180;
  const toLat = (to.latitude * Math.PI) / 180;
  const deltaLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const a = sinLat * sinLat + Math.cos(fromLat) * Math.cos(toLat) * sinLng * sinLng;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)} м`;
  }

  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} км` : `${Math.round(km)} км`;
}

export default function MapTabScreen() {
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<Coordinates | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoadError, setMapLoadError] = useState(false);
  const filterRailRef = useRef<ScrollView>(null);
  const fallbackCenter = useMemo(() => getDefaultMapCoordinates(), []);
  const layout = useResponsive();
  const compact = layout.isSmallPhone;
  const chipIconSize = compact ? 13 : 14;
  const locateButtonHeight = compact ? 40 : 44;
  const previewThumbSize = compact ? 62 : 76;

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<ServiceCategory[]>('/categories');
      return data;
    },
  });

  const workshopsQuery = useQuery({
    queryKey: ['workshops-map', categoryId],
    queryFn: async (): Promise<WorkshopsMapResult> => {
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
      } while (page <= pageCount && allItems.length < MAX_MAP_WORKSHOPS);

      return {
        items: allItems.slice(0, MAX_MAP_WORKSHOPS),
        limitReached: page <= pageCount || allItems.length > MAX_MAP_WORKSHOPS,
      };
    },
  });

  const categories = categoriesQuery.data ?? [];
  const workshops = workshopsQuery.data?.items ?? [];
  const mapLimitReached = Boolean(workshopsQuery.data?.limitReached);
  const mapWorkshops = useMemo(
    () =>
      workshops.filter((workshop) => {
        if (workshop.latitude == null || workshop.longitude == null) {
          return false;
        }

        if (!nearbyOnly || !deviceLocation) {
          return true;
        }

        return (
          getDistanceMeters(deviceLocation, {
            latitude: workshop.latitude,
            longitude: workshop.longitude,
          }) <= NEARBY_RADIUS_METERS
        );
      }),
    [deviceLocation, nearbyOnly, workshops],
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
  }): Promise<Coordinates | null> => {
    try {
      setIsLocating(true);

      const result = await getDeviceCoordinates(fallbackCenter);

      if (!result.coordinates) {
        if (forceCenter && !mapCenter) {
          setMapCenter(fallbackCenter);
        }

        if (!silent && result.permissionDenied) {
          showWarning(
            'Нет доступа к геопозиции',
            'Разрешите доступ к локации, чтобы показывать ваше место на карте.',
          );
        }
        return null;
      }
      const nextLocation = result.coordinates;

      setDeviceLocation(nextLocation);

      if (forceCenter || !mapCenter) {
        setMapCenter(nextLocation);
      }

      return nextLocation;
    } catch {
      if (forceCenter && !mapCenter) {
        setMapCenter(fallbackCenter);
      }

      if (!silent) {
        showError(
          'Не удалось определить геопозицию',
          'Проверьте доступ к геолокации и попробуйте ещё раз.',
        );
      }
      return null;
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
  const selectedWorkshopDistance =
    selectedWorkshop && deviceLocation && selectedWorkshop.latitude != null && selectedWorkshop.longitude != null
      ? getDistanceMeters(deviceLocation, {
          latitude: selectedWorkshop.latitude,
          longitude: selectedWorkshop.longitude,
        })
      : null;

  const handleNearbyPress = async () => {
    if (nearbyOnly) {
      setNearbyOnly(false);
      return;
    }

    const location = await resolveDeviceLocation({ forceCenter: true });
    setNearbyOnly(Boolean(location));
  };

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
    <Screen
      scroll={false}
      edges={['top', 'left', 'right']}
      style={[
        styles.screenContent,
        {
          paddingHorizontal: compact ? 8 : 12,
          paddingBottom: compact ? 8 : 12,
          gap: compact ? 8 : 10,
        },
      ]}
    >
      <ScrollView
        ref={filterRailRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRailWrap}
        contentContainerStyle={[
          styles.filterRail,
          {
            gap: compact ? 6 : 8,
            paddingHorizontal: compact ? 2 : 4,
          },
        ]}
      >
        <Pressable
          onPress={() => setCategoryId(undefined)}
          style={[
            styles.chip,
            {
              paddingHorizontal: compact ? 10 : 12,
              paddingVertical: compact ? 7 : 8,
            },
            !categoryId && styles.chipActive,
          ]}
        >
          <Ionicons
            name="grid-outline"
            size={chipIconSize}
            color={!categoryId ? '#FFFFFF' : colors.accentDark}
          />
          <Text
            style={[
              styles.chipText,
              { fontSize: layout.font(13, 0.15, 12, 14) },
              !categoryId && styles.chipTextActive,
            ]}
          >
            Все
          </Text>
        </Pressable>

        {categories.map((category) => {
          const active = categoryId === category.id;
          return (
            <Pressable
              key={category.id}
              onPress={() => setCategoryId(active ? undefined : category.id)}
              style={[
                styles.chip,
                {
                  paddingHorizontal: compact ? 10 : 12,
                  paddingVertical: compact ? 7 : 8,
                },
                active && styles.chipActive,
              ]}
            >
              <Ionicons
                name={getCategoryIcon(category.slug)}
                size={chipIconSize}
                color={active ? '#FFFFFF' : colors.accentDark}
              />
              <Text
                style={[
                  styles.chipText,
                  { fontSize: layout.font(13, 0.15, 12, 14) },
                  active && styles.chipTextActive,
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => void handleNearbyPress()}
          disabled={isLocating}
          style={[
            styles.chip,
            {
              paddingHorizontal: compact ? 10 : 12,
              paddingVertical: compact ? 7 : 8,
            },
            nearbyOnly && styles.chipActive,
          ]}
        >
          {isLocating ? (
            <ActivityIndicator color={nearbyOnly ? '#FFFFFF' : colors.accentDark} size="small" />
          ) : (
            <Ionicons
              name="locate-outline"
              size={chipIconSize}
              color={nearbyOnly ? '#FFFFFF' : colors.accentDark}
            />
          )}
          <Text
            style={[
              styles.chipText,
              { fontSize: layout.font(13, 0.15, 12, 14) },
              nearbyOnly && styles.chipTextActive,
            ]}
          >
            Рядом
          </Text>
        </Pressable>
      </ScrollView>

      {workshopsQuery.isError || categoriesQuery.isError ? <NetworkBanner /> : null}
      {mapLimitReached ? (
        <View style={styles.limitNotice}>
          <Ionicons name="layers-outline" size={16} color={colors.accentDark} />
          <Text style={styles.limitNoticeText}>
            На карте показаны первые {MAX_MAP_WORKSHOPS} точек. Уточните категорию или включите
            “Рядом”.
          </Text>
        </View>
      ) : null}

      <View style={[styles.mapCard, { borderRadius: compact ? 18 : 24 }]}>
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={styles.map}
          onLoadStart={() => {
            setMapReady(false);
            setMapLoadError(false);
          }}
          onLoadEnd={() => setMapReady(true)}
          onError={() => {
            setMapLoadError(true);
            setMapReady(false);
          }}
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

        {workshopsQuery.isLoading || (!mapReady && !mapLoadError) ? (
          <View style={styles.mapStateOverlay}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.mapStateTitle}>Загружаем карту</Text>
          </View>
        ) : null}

        {workshopsQuery.isError || mapLoadError ? (
          <View style={styles.mapStateOverlay}>
            <Ionicons name="map-outline" size={28} color={colors.accentDark} />
            <Text style={styles.mapStateTitle}>Карта не загрузилась</Text>
            <Text style={styles.mapStateText}>
              Проверьте интернет и попробуйте обновить точки на карте.
            </Text>
            <Pressable
              onPress={() => {
                setMapReady(false);
                setMapLoadError(false);
                void workshopsQuery.refetch();
              }}
              style={styles.mapRetryButton}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.accentDark} />
              <Text style={styles.mapRetryText}>Повторить</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={() => void resolveDeviceLocation({ forceCenter: true })}
          style={[
            styles.locateButton,
            {
              top: compact ? 8 : 12,
              right: compact ? 8 : 12,
              height: locateButtonHeight,
              borderRadius: compact ? 12 : 14,
            },
          ]}
        >
          {isLocating ? (
            <ActivityIndicator color={colors.accentDark} size="small" />
          ) : (
            <>
              <Ionicons name="locate-outline" size={20} color={colors.accentDark} />
              <Text style={styles.locateButtonText}>Рядом</Text>
            </>
          )}
        </Pressable>

        {selectedWorkshop ? (
          <View
            style={[
              styles.previewOverlay,
              {
                left: compact ? 8 : 12,
                right: compact ? 8 : 12,
                bottom: compact ? 8 : 12,
                padding: compact ? 10 : 12,
                gap: compact ? 10 : 12,
                borderRadius: compact ? 18 : 22,
              },
            ]}
          >
            <View style={[styles.previewRow, { gap: compact ? 10 : 12 }]}>
              <View
                style={[
                  styles.previewThumb,
                  {
                    width: previewThumbSize,
                    height: previewThumbSize,
                    borderRadius: compact ? 14 : 18,
                  },
                ]}
              >
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
                <Text
                  numberOfLines={1}
                  style={[styles.previewTitle, { fontSize: layout.font(17, 0.2, 15, 18) }]}
                >
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
                {selectedWorkshopDistance != null ? (
                  <Text style={styles.previewDistance}>
                    Примерно {formatDistance(selectedWorkshopDistance)} от вас
                  </Text>
                ) : null}
                {selectedWorkshop.isVerifiedMaster ? (
                  <View style={styles.previewVerified}>
                    <Ionicons name="shield-checkmark" size={12} color="#FFFFFF" />
                    <Text style={styles.previewVerifiedText}>Проверенный мастер</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={[styles.previewActions, compact && styles.previewActionsCompact]}>
              <Pressable
                onPress={() =>
                  void callPhone(selectedWorkshop.phone).then((result) => {
                    if (!result.ok) {
                      showError(result.title, result.message);
                    }
                  })
                }
                style={({ pressed }) => [
                  styles.previewCallButton,
                  { height: compact ? 44 : 48, borderRadius: compact ? 15 : 17 },
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Позвонить мастеру ${selectedWorkshop.phone}`}
              >
                <Ionicons name="call" size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={() =>
                  void openRoute(
                    selectedWorkshop.latitude as number,
                    selectedWorkshop.longitude as number,
                    selectedWorkshop.title,
                  ).then((result) => {
                    if (!result.ok) {
                      showError(result.title, result.message);
                    }
                  })
                }
                style={({ pressed }) => [
                  styles.previewRouteButton,
                  {
                    height: compact ? 44 : 48,
                    borderRadius: compact ? 15 : 17,
                  },
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Построить маршрут до ${selectedWorkshop.title}`}
              >
                <Ionicons name="navigate" size={18} color={colors.accentDark} />
                <Text style={styles.previewRouteText}>Маршрут</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/workshop/${selectedWorkshop.id}`)}
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.previewOpenButton,
                  {
                    height: compact ? 44 : 48,
                    borderRadius: compact ? 15 : 17,
                  },
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Открыть карточку ${selectedWorkshop.title}`}
              >
                <Text style={styles.primaryText}>Открыть</Text>
              </Pressable>
            </View>
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
    height: 44,
    minWidth: 92,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 253, 249, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(24, 33, 32, 0.08)',
  },
  locateButtonText: {
    color: colors.accentDark,
    fontWeight: '800',
    fontSize: 13,
  },
  limitNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FFF7DD',
    borderWidth: 1,
    borderColor: '#EEDDAB',
  },
  limitNoticeText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  mapStateOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    backgroundColor: 'rgba(244, 239, 231, 0.92)',
  },
  mapStateTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  mapStateText: {
    maxWidth: 260,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  mapRetryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFF0E5',
    borderWidth: 1,
    borderColor: '#F1D1BC',
  },
  mapRetryText: {
    color: colors.accentDark,
    fontWeight: '800',
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
  previewDistance: {
    color: colors.success,
    fontWeight: '800',
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
  previewActions: {
    flexDirection: 'row',
    gap: 8,
  },
  previewActionsCompact: {
    gap: 6,
  },
  previewCallButton: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  previewRouteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF0E5',
    borderWidth: 1,
    borderColor: '#F1D1BC',
  },
  previewRouteText: {
    color: colors.accentDark,
    fontWeight: '800',
  },
  previewOpenButton: {
    flex: 1,
    paddingVertical: 0,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
