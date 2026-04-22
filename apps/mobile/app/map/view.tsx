import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Screen } from '../../components/screen';
import { colors } from '../../src/constants/theme';
import { createLeafletHtml } from '../../src/utils/leaflet-html';
import { openExternalMap } from '../../src/utils/maps';

export default function MapViewScreen() {
  const params = useLocalSearchParams<{
    latitude?: string;
    longitude?: string;
    title?: string;
    address?: string;
  }>();

  const latitude = Number(params.latitude);
  const longitude = Number(params.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

  const html = useMemo(() => {
    if (!hasCoordinates) {
      return null;
    }

    return createLeafletHtml({
      latitude,
      longitude,
      title: params.title || 'СТО',
      subtitle: params.address || 'Локация на карте',
    });
  }, [hasCoordinates, latitude, longitude, params.address, params.title]);

  if (!hasCoordinates || !html) {
    return (
      <Screen>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Локация пока не указана</Text>
          <Text style={styles.emptyText}>
            Мастер ещё не добавил точную точку на карте для этого объявления.
          </Text>
          <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Назад</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} style={styles.content}>
      <View style={styles.mapCard}>
        <WebView originWhitelist={['*']} source={{ html }} style={styles.map} />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.title}>{params.title || 'СТО'}</Text>
        {params.address ? <Text style={styles.subtitle}>{params.address}</Text> : null}
        <Text style={styles.coords}>
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </Text>
      </View>

      <Pressable
        onPress={() =>
          openExternalMap(latitude, longitude, params.title || params.address || 'СТО')
        }
        style={styles.primaryButton}
      >
        <Text style={styles.primaryText}>Открыть в навигаторе</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 16,
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
  infoCard: {
    gap: 8,
    padding: 18,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    color: colors.muted,
    lineHeight: 20,
  },
  coords: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyCard: {
    gap: 12,
    padding: 20,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 20,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: '#FFF0E5',
    alignSelf: 'flex-start',
  },
  secondaryText: {
    color: colors.accentDark,
    fontWeight: '700',
  },
});
