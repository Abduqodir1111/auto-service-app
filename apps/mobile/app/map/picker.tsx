import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Screen } from '../../components/screen';
import { colors } from '../../src/constants/theme';
import { useMapPickerStore } from '../../src/store/map-picker-store';
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
  const initialLocation = storeLocation ?? {
    latitude: fallback.latitude,
    longitude: fallback.longitude,
    updatedAt: Date.now(),
  };

  const [selectedLocation, setPreviewLocation] = useState({
    latitude: initialLocation.latitude,
    longitude: initialLocation.longitude,
  });

  const html = useMemo(
    () =>
      createLeafletHtml({
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
        interactive: true,
        title: 'Точка объявления',
        subtitle: 'Переместите маркер или тапните по карте',
      }),
    [initialLocation.latitude, initialLocation.longitude],
  );

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
