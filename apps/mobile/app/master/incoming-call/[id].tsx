import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ServiceCallItem, ServiceCallStatus } from '@stomvp/shared';
import { Screen } from '../../../components/screen';
import { api } from '../../../src/api/client';
import { colors } from '../../../src/constants/theme';
import { getDeviceCoordinates } from '../../../src/utils/device-location';

const MASTER_LOCATION_INTERVAL_MS = 15_000;

const SWIPE_TRACK_HEIGHT = 70;
const ACCEPT_THRESHOLD_RATIO = 0.65;
const POLL_INTERVAL_MS = 1_500;

export default function MasterIncomingCallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const callQuery = useQuery({
    queryKey: ['service-call', id],
    queryFn: async () => {
      const { data } = await api.get<ServiceCallItem>(`/service-calls/${id}`);
      return data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === ServiceCallStatus.SEARCHING) return POLL_INTERVAL_MS;
      // Keep polling while ASSIGNED so master sees if client cancelled.
      if (status === ServiceCallStatus.ASSIGNED) return 5_000;
      return false;
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ServiceCallItem>(`/service-calls/${id}/accept`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-call', id] });
    },
    onError: () => {
      Alert.alert(
        'Не удалось принять',
        'Возможно, время вышло или вызов уже принял другой мастер.',
      );
      router.back();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/service-calls/${id}/reject`);
    },
    onSuccess: () => {
      router.back();
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/service-calls/${id}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-call', id] });
      router.back();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/service-calls/${id}/cancel`);
    },
    onSuccess: () => {
      Alert.alert('Вызов отменён', 'Клиент получил уведомление.');
      router.back();
    },
    onError: () => {
      Alert.alert('Ошибка', 'Не удалось отменить вызов.');
    },
  });

  const call = callQuery.data;

  // While ASSIGNED, push the master's GPS to the server every 15s so
  // the client can render a live "where is the master right now" pin
  // and ETA. We bail as soon as the call leaves ASSIGNED.
  useEffect(() => {
    if (call?.status !== ServiceCallStatus.ASSIGNED) return;
    let cancelled = false;
    const send = async () => {
      try {
        const result = await getDeviceCoordinates(null);
        if (cancelled || !result.coordinates) return;
        await api.post(`/service-calls/${id}/master-location`, {
          lat: result.coordinates.latitude,
          lng: result.coordinates.longitude,
        });
      } catch {
        // best-effort — next tick will retry
      }
    };
    void send();
    const timer = setInterval(send, MASTER_LOCATION_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [call?.status, id]);

  if (callQuery.isLoading || !call) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  // Once accepted, show contact card with phone-call button.
  if (call.status === ServiceCallStatus.ASSIGNED) {
    return (
      <Screen style={styles.container}>
        <View style={styles.assignedCard}>
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          <Text style={styles.assignedTitle}>Вы приняли вызов</Text>
          <Text style={styles.muted}>
            Свяжитесь с клиентом и обсудите цену и подробности.
          </Text>
          <View style={styles.divider} />
          <Text style={styles.label}>Клиент</Text>
          <Text style={styles.value}>{call.client?.fullName ?? 'Клиент'}</Text>
          <Text style={styles.label}>Телефон</Text>
          <Text style={styles.value}>{call.clientPhone}</Text>
          {call.address ? (
            <>
              <Text style={styles.label}>Адрес</Text>
              <Text style={styles.value}>{call.address}</Text>
            </>
          ) : null}
          <Text style={styles.label}>Точка</Text>
          <Text style={styles.value}>
            {call.lat.toFixed(5)}, {call.lng.toFixed(5)}
          </Text>
          {call.description ? (
            <>
              <Text style={styles.label}>Описание</Text>
              <Text style={styles.value}>{call.description}</Text>
            </>
          ) : null}
        </View>
        <Pressable
          onPress={() => Linking.openURL(`tel:${call.clientPhone}`)}
          style={styles.primaryButton}
        >
          <Ionicons name="call" size={20} color="#FFFFFF" />
          <Text style={styles.primaryText}>Позвонить клиенту</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            Linking.openURL(`https://www.google.com/maps?q=${call.lat},${call.lng}`)
          }
          style={styles.secondaryButton}
        >
          <Ionicons name="navigate" size={18} color={colors.accentDark} />
          <Text style={styles.secondaryText}>Открыть в картах</Text>
        </Pressable>
        <Pressable onPress={() => completeMutation.mutate()} style={styles.successButton}>
          <Text style={styles.successText}>
            {completeMutation.isPending ? 'Отмечаем...' : 'Готово, вызов завершён'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() =>
            Alert.alert(
              'Отменить вызов?',
              'Клиент получит уведомление и сможет вызвать другого мастера.',
              [
                { text: 'Не отменять', style: 'cancel' },
                {
                  text: 'Отменить вызов',
                  style: 'destructive',
                  onPress: () => cancelMutation.mutate(),
                },
              ],
            )
          }
          disabled={cancelMutation.isPending}
          style={[styles.dangerButton, cancelMutation.isPending && styles.disabled]}
        >
          <Text style={styles.dangerText}>
            {cancelMutation.isPending ? 'Отменяем...' : 'Отменить вызов'}
          </Text>
        </Pressable>
      </Screen>
    );
  }

  if (call.status !== ServiceCallStatus.SEARCHING) {
    // Already moved on (cancelled / no_masters / completed) — nothing to swipe.
    return (
      <Screen style={styles.container}>
        <Ionicons name="time-outline" size={64} color={colors.muted} />
        <Text style={styles.assignedTitle}>Вызов уже завершён</Text>
        <Pressable onPress={() => router.back()} style={styles.primaryButton}>
          <Text style={styles.primaryText}>Закрыть</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <RingingView
      call={call}
      onAccept={() => acceptMutation.mutate()}
      onReject={() => rejectMutation.mutate()}
      isAccepting={acceptMutation.isPending}
    />
  );
}

/**
 * Active "ringing" view with a 30s countdown and swipe-to-accept track.
 * Extracted so its hooks (PanResponder, animations) only mount while the
 * call is actually SEARCHING — avoids stale animation state when we
 * transition into ASSIGNED above.
 */
function RingingView({
  call,
  onAccept,
  onReject,
  isAccepting,
}: {
  call: ServiceCallItem;
  onAccept: () => void;
  onReject: () => void;
  isAccepting: boolean;
}) {
  const screenWidth = Dimensions.get('window').width;
  const trackWidth = screenWidth - 64; // matches the screen padding+margins
  const acceptThreshold = trackWidth * ACCEPT_THRESHOLD_RATIO;

  // Time remaining until the dispatcher rotates us off (server-controlled).
  const expiresAt = call.currentExpiresAt ? new Date(call.currentExpiresAt).getTime() : null;
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1_000));
  });

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1_000));
      setSecondsLeft(left);
      if (left === 0) {
        // Server will rotate us off automatically; bounce back to wherever
        // we came from so the master isn't stuck on a dead screen.
        router.back();
      }
    };
    tick();
    const timer = setInterval(tick, 1_000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const swipeX = useRef(new Animated.Value(0)).current;
  const acceptedRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 5,
      onPanResponderMove: (_, gesture) => {
        if (acceptedRef.current) return;
        const next = Math.max(0, Math.min(trackWidth - 60, gesture.dx));
        swipeX.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        if (acceptedRef.current) return;
        if (gesture.dx >= acceptThreshold) {
          acceptedRef.current = true;
          Animated.timing(swipeX, {
            toValue: trackWidth - 60,
            duration: 150,
            useNativeDriver: false,
          }).start(() => onAccept());
        } else {
          Animated.spring(swipeX, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (acceptedRef.current) return;
        Animated.spring(swipeX, { toValue: 0, useNativeDriver: false }).start();
      },
    }),
  ).current;

  return (
    <Screen style={styles.container}>
      <View style={styles.urgentBadge}>
        <Ionicons name="alert" size={18} color="#FFFFFF" />
        <Text style={styles.urgentText}>Срочный вызов</Text>
      </View>

      <View style={styles.timerCard}>
        <Text style={styles.timerLabel}>Осталось принять</Text>
        <Text style={styles.timerValue}>{secondsLeft}s</Text>
      </View>

      <View style={styles.detailCard}>
        <Text style={styles.label}>Куда ехать</Text>
        <Text style={styles.value}>
          {call.address ?? `${call.lat.toFixed(5)}, ${call.lng.toFixed(5)}`}
        </Text>
        {call.description ? (
          <>
            <Text style={styles.label}>Описание</Text>
            <Text style={styles.value}>{call.description}</Text>
          </>
        ) : null}
        <Text style={styles.label}>Телефон клиента</Text>
        <Text style={styles.value}>{call.clientPhone}</Text>
      </View>

      <View style={[styles.swipeTrack, { width: trackWidth }]}>
        <Text style={styles.swipeHint}>→ свайп вправо, чтобы принять</Text>
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.swipeThumb, { transform: [{ translateX: swipeX }] }]}
        >
          {isAccepting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Ionicons name="arrow-forward" size={28} color="#FFFFFF" />
          )}
        </Animated.View>
      </View>

      <Pressable onPress={onReject} style={styles.rejectButton}>
        <Text style={styles.rejectText}>Отказаться</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 24,
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#D75A43',
  },
  urgentText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timerCard: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerLabel: {
    color: colors.muted,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timerValue: {
    fontSize: 56,
    fontWeight: '800',
    color: '#D75A43',
    fontVariant: ['tabular-nums'],
  },
  detailCard: {
    alignSelf: 'stretch',
    gap: 6,
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
  },
  value: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  muted: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  swipeTrack: {
    height: SWIPE_TRACK_HEIGHT,
    borderRadius: SWIPE_TRACK_HEIGHT / 2,
    backgroundColor: '#E5F4EE',
    borderWidth: 2,
    borderColor: '#7FBE9C',
    justifyContent: 'center',
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  swipeHint: {
    textAlign: 'center',
    color: '#3A8B5D',
    fontWeight: '700',
    fontSize: 15,
  },
  swipeThumb: {
    position: 'absolute',
    left: 4,
    width: SWIPE_TRACK_HEIGHT - 8,
    height: SWIPE_TRACK_HEIGHT - 8,
    borderRadius: (SWIPE_TRACK_HEIGHT - 8) / 2,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 18,
    backgroundColor: '#FFF4F0',
    borderWidth: 1,
    borderColor: '#E7B5A9',
  },
  rejectText: {
    color: '#C55B3C',
    fontWeight: '700',
    fontSize: 15,
  },
  dangerButton: {
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#FFF4F0',
    borderWidth: 1,
    borderColor: '#E7B5A9',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  dangerText: {
    color: '#C55B3C',
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignSelf: 'stretch',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 17,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: '#FFF0E5',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  secondaryText: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  successButton: {
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#E5F4EE',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BDDDC8',
    alignSelf: 'stretch',
  },
  successText: {
    color: colors.success,
    fontWeight: '700',
  },
  assignedCard: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    gap: 4,
    padding: 20,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  assignedTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    alignSelf: 'center',
    marginVertical: 6,
  },
  divider: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
});
