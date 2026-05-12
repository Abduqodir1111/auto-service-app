import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { ServiceCallItem, UserRole } from '@stomvp/shared';
import { api } from '../src/api/client';
import { useAuthStore } from '../src/store/auth-store';

/**
 * Floating "call master" button shown on the client catalog.
 *
 * Hidden when:
 *  - user isn't a CLIENT
 *  - there's already an active call (CallStatusBanner takes over)
 *
 * Shakes like a ringing phone every few seconds to draw attention,
 * and triggers a haptic pulse on press.
 */
export function CallMasterFab() {
  const role = useAuthStore((state) => state.session?.user.role);

  const query = useQuery({
    queryKey: ['service-call-active-client'],
    queryFn: async () => {
      const { data } = await api.get<ServiceCallItem | null>('/service-calls/client/active');
      return data;
    },
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    enabled: role === UserRole.CLIENT,
  });

  const shake = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Ringing-phone shake — short burst every few seconds.
    const wiggle = Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]);
    const cycle = Animated.loop(
      Animated.sequence([wiggle, Animated.delay(2400)]),
    );
    cycle.start();

    const ring = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(1200),
      ]),
    );
    ring.start();

    return () => {
      cycle.stop();
      ring.stop();
    };
  }, [pulse, shake]);

  if (role !== UserRole.CLIENT || query.data) {
    return null;
  }

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const rotate = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-12deg', '12deg'] });

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <Animated.View
        pointerEvents="none"
        style={[styles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
      />
      <Pressable
        onPress={() => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          router.push('/call');
        }}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Срочный вызов мастера"
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="call" size={28} color="#FFFFFF" />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D75A43',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D75A43',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D75A43',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
});
