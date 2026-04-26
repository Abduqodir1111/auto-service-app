import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Screen } from '../../components/screen';
import { colors } from '../../src/constants/theme';
import { useMapPickerStore } from '../../src/store/map-picker-store';
import { getDeviceCoordinates } from '../../src/utils/device-location';
import { createLeafletHtml } from '../../src/utils/leaflet-html';
import { getDefaultMapCoordinates } from '../../src/utils/maps';

type MapMessage = {
  type: 'ready' | 'location-change';
  latitude: number;
  longitude: number;
};

export default function MapPickerScreen() {
  const storeLocation = useMapPickerStore((state) => state.pickerInitialLocation);
  const commitSelectedLocation = useMapPickerStore((state) => state.setSelectedLocation);
  const fallback = getDefaultMapCoordinates();
  const defaultInitialLocation = storeLocation ?? {
    latitude: fallback.latitude,
    longitude: fallback.longitude,
    updatedAt: Date.now(),
  };
  const [mapInitialLocation, setMapInitialLocation] = useState(defaultInitialLocation);
  const [isLocating, setIsLocating] = useState(false);

  const [selectedLocation, setPreviewLocation] = useState({
    latitude: defaultInitialLocation.latitude,
    longitude: defaultInitialLocation.longitude,
  });

  useEffect(() => {
    const nextLocation = storeLocation ?? {
      latitude: fallback.latitude,
      longitude: fallback.longitude,
      updatedAt: Date.now(),
    };

    setMapInitialLocation(nextLocation);
    setPreviewLocation({
      latitude: nextLocation.latitude,
      longitude: nextLocation.longitude,
    });
  }, [fallback.latitude, fallback.longitude, storeLocation]);

  useEffect(() => {
    if (storeLocation) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setIsLocating(true);
        const result = await getDeviceCoordinates(fallback);

        if (cancelled || !result.coordinates) {
          return;
        }

        const nextLocation = {
          latitude: result.coordinates.latitude,
          longitude: result.coordinates.longitude,
          updatedAt: Date.now(),
        };

        setMapInitialLocation(nextLocation);
        setPreviewLocation({
          latitude: nextLocation.latitude,
          longitude: nextLocation.longitude,
        });
      } finally {
        if (!cancelled) {
          setIsLocating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fallback, storeLocation]);

  const html = useMemo(
    () =>
      createLeafletHtml({
        latitude: mapInitialLocation.latitude,
        longitude: mapInitialLocation.longitude,
        interactive: true,
        title: 'Точка объявления',
        subtitle: 'Переместите маркер или тапните по карте',
      }),
    [mapInitialLocation.latitude, mapInitialLocation.longitude],
  );

  const locateMe = async () => {
    try {
      setIsLocating(true);
      const result = await getDeviceCoordinates(fallback);

      if (!result.coordinates) {
        if (result.permissionDenied) {
          Alert.alert(
            'Нет доступа к геопозиции',
            'Разрешите доступ к локации, чтобы сразу поставить точку рядом с вами.',
          );
        }
        return;
      }

      const nextLocation = {
        latitude: result.coordinates.latitude,
        longitude: result.coordinates.longitude,
        updatedAt: Date.now(),
      };

      setMapInitialLocation(nextLocation);
      setPreviewLocation({
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude,
      });
    } catch {
      Alert.alert(
        'Не удалось определить геопозицию',
        'Проверьте доступ к геолокации и попробуйте ещё раз.',
      );
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <Screen scroll={false} style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Укажите точку на карте</Text>
        <Text style={styles.subtitle}>
          Клиенты будут видеть эту геопозицию в карточке объявления и смогут открыть карту.
        </Text>
      </View>

      <View style={styles.mapCard}>
        <WebView
          source={{ html }}
          originWhitelist={['*']}
          style={styles.map}
          onMessage={(event) => {
            try {
              const payload = JSON.parse(event.nativeEvent.data) as MapMessage;
              if (payload.type === 'ready' || payload.type === 'location-change') {
                setPreviewLocation({
                  latitude: payload.latitude,
                  longitude: payload.longitude,
                });
              }
            } catch {
              return;
            }
          }}
        />

        <Pressable onPress={() => void locateMe()} style={styles.locateButton}>
          {isLocating ? (
            <ActivityIndicator size="small" color={colors.accentDark} />
          ) : (
            <Text style={styles.locateButtonText}>Где я</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.coordsCard}>
        <Text style={styles.coordsLabel}>Выбранная точка</Text>
        <Text style={styles.coordsValue}>
          {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Отмена</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            commitSelectedLocation({
              latitude: selectedLocation.latitude,
              longitude: selectedLocation.longitude,
              updatedAt: Date.now(),
            });
            router.back();
          }}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryText}>Сохранить точку</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 16,
  },
  header: {
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
  mapCard: {
    flex: 1,
    minHeight: 360,
    overflow: 'hidden',
    borderRadius: 26,
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
    minWidth: 72,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 253, 249, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(24, 33, 32, 0.08)',
  },
  locateButtonText: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  coordsCard: {
    gap: 6,
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coordsLabel: {
    color: colors.muted,
    fontSize: 13,
  },
  coordsValue: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: '#FFF0E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryText: {
    color: colors.accentDark,
    fontWeight: '700',
  },
});
