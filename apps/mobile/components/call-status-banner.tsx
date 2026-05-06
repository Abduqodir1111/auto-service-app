import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { ServiceCallItem, ServiceCallStatus } from '@stomvp/shared';
import { api } from '../src/api/client';
import { colors } from '../src/constants/theme';

/**
 * Live "Срочный вызов" card for the client home screen.
 *
 * Three states:
 *   - default: red "Вызвать мастера" button → navigates to /call
 *   - SEARCHING: amber pulsing banner with elapsed time, taps into /call/:id
 *   - ASSIGNED: green banner with master name + distance, taps into /call/:id
 *
 * Polls /service-calls/client/active every 5s. Backend returns null when
 * there's no live call so the card silently falls back to default.
 */
export function CallStatusBanner() {
  const query = useQuery({
    queryKey: ['service-call-active-client'],
    queryFn: async () => {
      const { data } = await api.get<ServiceCallItem | null>('/service-calls/client/active');
      return data;
    },
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  const call = query.data;

  if (call?.status === ServiceCallStatus.SEARCHING) {
    return <SearchingBanner call={call} />;
  }
  if (call?.status === ServiceCallStatus.ASSIGNED) {
    return <AssignedBanner call={call} />;
  }
  return <DefaultBanner />;
}

function DefaultBanner() {
  return (
    <Pressable onPress={() => router.push('/call')} style={styles.default}>
      <View style={styles.iconWrap}>
        <Ionicons name="alert" size={22} color="#FFFFFF" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Срочный вызов мастера</Text>
        <Text style={styles.subtitle}>Ближайший доступный мастер позвонит вам</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
    </Pressable>
  );
}

function SearchingBanner({ call }: { call: ServiceCallItem }) {
  const elapsed = useElapsed(call.createdAt);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const opacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });

  return (
    <Pressable onPress={() => router.push(`/call/${call.id}`)} style={styles.searching}>
      <Animated.View style={[styles.iconWrap, { opacity, backgroundColor: 'rgba(255,255,255,0.18)' }]}>
        <Ionicons name="search" size={22} color="#FFFFFF" />
      </Animated.View>
      <View style={styles.copy}>
        <Text style={styles.title}>Ищем мастера...</Text>
        <Text style={styles.subtitle}>Передаём вашу заявку • {elapsed}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
    </Pressable>
  );
}

function AssignedBanner({ call }: { call: ServiceCallItem }) {
  const distance =
    call.masterLat != null && call.masterLng != null
      ? haversineKm(call.lat, call.lng, call.masterLat, call.masterLng)
      : null;
  const eta =
    distance != null
      ? Math.max(1, Math.round((distance / 25) * 60)) // 25 km/h city ETA
      : null;

  const masterName = call.assignedMaster?.fullName ?? 'Мастер';

  return (
    <Pressable onPress={() => router.push(`/call/${call.id}`)} style={styles.assigned}>
      <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
        <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{masterName} в пути</Text>
        <Text style={styles.subtitle}>
          {distance != null
            ? `~${distance.toFixed(1)} км${eta != null ? ` • ${eta} мин` : ''} • тапни для деталей`
            : 'Мастер скоро поделится локацией • тапни для деталей'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
    </Pressable>
  );
}

function useElapsed(createdAt: string) {
  const startMs = new Date(createdAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const sec = Math.max(0, Math.floor((now - startMs) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Great-circle distance in km between two lat/lng points. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const styles = StyleSheet.create({
  default: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: '#D75A43',
    marginBottom: 4,
  },
  searching: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: '#E89A4A',
    marginBottom: 4,
  },
  assigned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: '#3FA76C',
    marginBottom: 4,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 13,
  },
});
