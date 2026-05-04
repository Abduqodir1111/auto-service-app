import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ServiceCallItem, ServiceCallStatus } from '@stomvp/shared';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';

const POLL_INTERVAL_MS = 2_000;

export default function CallStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showComplaint, setShowComplaint] = useState(false);
  const [complaintReason, setComplaintReason] = useState('');
  const [complaintComment, setComplaintComment] = useState('');
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Looping pulse animation while we're SEARCHING — visual heartbeat so the
  // client sees something is happening even on a stale screen.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1_200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1_200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const callQuery = useQuery({
    queryKey: ['service-call', id],
    queryFn: async () => {
      const { data } = await api.get<ServiceCallItem>(`/service-calls/${id}`);
      return data;
    },
    refetchInterval: (query) => {
      // Stop polling once the call reached a terminal state.
      const status = query.state.data?.status;
      if (
        status === ServiceCallStatus.ASSIGNED ||
        status === ServiceCallStatus.COMPLETED ||
        status === ServiceCallStatus.CANCELLED ||
        status === ServiceCallStatus.NO_MASTERS
      ) {
        return status === ServiceCallStatus.ASSIGNED ? POLL_INTERVAL_MS * 5 : false;
      }
      return POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: true,
  });

  // Tick a wall-clock counter so the waiting card shows elapsed time.
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1_000));
    }, 1_000);
    return () => clearInterval(timer);
  }, [id]);

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/service-calls/${id}/cancel`);
    },
    onSuccess: () => {
      Alert.alert('Вызов отменён');
      router.back();
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/service-calls/${id}/complete`);
    },
    onSuccess: () => {
      Alert.alert('Спасибо!', 'Вызов завершён.');
      router.back();
    },
  });

  const complainMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/service-calls/${id}/complain`, {
        reason: complaintReason.trim(),
        comment: complaintComment.trim() || undefined,
      });
    },
    onSuccess: () => {
      Alert.alert('Жалоба отправлена', 'Администраторы рассмотрят её в ближайшее время.');
      setShowComplaint(false);
      router.back();
    },
    onError: () => {
      Alert.alert('Ошибка', 'Не удалось отправить жалобу. Попробуйте ещё раз.');
    },
  });

  const call = callQuery.data;

  if (callQuery.isLoading || !call) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (call.status === ServiceCallStatus.SEARCHING) {
    const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
    const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });
    return (
      <Screen style={styles.searchContainer}>
        <View style={styles.pulseWrap}>
          <Animated.View
            style={[
              styles.pulseRing,
              { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseRing,
              styles.pulseRingInner,
              { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
            ]}
          />
          <View style={styles.pulseCore}>
            <Ionicons name="alert" size={36} color="#FFFFFF" />
          </View>
        </View>
        <Text style={styles.searchTitle}>Ищем мастера...</Text>
        <Text style={styles.muted}>
          Передаём ваш вызов ближайшим доступным мастерам по очереди.
        </Text>
        <Text style={styles.elapsed}>{formatElapsed(elapsedSec)}</Text>
        <Pressable
          onPress={() => cancelMutation.mutate()}
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

  if (call.status === ServiceCallStatus.NO_MASTERS) {
    return (
      <Screen style={styles.searchContainer}>
        <Ionicons name="sad-outline" size={64} color={colors.muted} />
        <Text style={styles.searchTitle}>Свободных мастеров нет</Text>
        <Text style={styles.muted}>
          Сейчас рядом нет мастеров, готовых принять вызов. Попробуйте через 5–10 минут или создайте обычную заявку.
        </Text>
        <Pressable onPress={() => router.back()} style={styles.primaryButton}>
          <Text style={styles.primaryText}>Назад</Text>
        </Pressable>
      </Screen>
    );
  }

  if (call.status === ServiceCallStatus.CANCELLED) {
    return (
      <Screen style={styles.searchContainer}>
        <Ionicons name="close-circle" size={64} color={colors.muted} />
        <Text style={styles.searchTitle}>Вызов отменён</Text>
        <Pressable onPress={() => router.back()} style={styles.primaryButton}>
          <Text style={styles.primaryText}>Назад</Text>
        </Pressable>
      </Screen>
    );
  }

  if (call.status === ServiceCallStatus.COMPLETED) {
    return (
      <Screen style={styles.searchContainer}>
        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
        <Text style={styles.searchTitle}>Вызов завершён</Text>
        <Pressable onPress={() => router.back()} style={styles.primaryButton}>
          <Text style={styles.primaryText}>Готово</Text>
        </Pressable>
      </Screen>
    );
  }

  // ASSIGNED
  const master = call.assignedMaster;
  return (
    <Screen>
      <View style={styles.assignedCard}>
        <Ionicons name="person-circle" size={56} color={colors.accent} />
        <Text style={styles.assignedTitle}>Мастер найден</Text>
        <Text style={styles.assignedName}>{master?.fullName ?? 'Мастер'}</Text>
        <Text style={styles.muted}>{master?.phone ?? ''}</Text>
      </View>

      <Pressable
        onPress={() => master?.phone && Linking.openURL(`tel:${master.phone}`)}
        style={styles.primaryButton}
      >
        <Ionicons name="call" size={20} color="#FFFFFF" />
        <Text style={styles.primaryText}>Позвонить мастеру</Text>
      </Pressable>

      <Pressable onPress={() => completeMutation.mutate()} style={styles.successButton}>
        <Text style={styles.successText}>
          {completeMutation.isPending ? 'Отмечаем...' : 'Мастер приехал, всё хорошо'}
        </Text>
      </Pressable>

      {!showComplaint ? (
        <Pressable onPress={() => setShowComplaint(true)} style={styles.dangerButton}>
          <Text style={styles.dangerText}>Мастер не приехал — пожаловаться</Text>
        </Pressable>
      ) : (
        <View style={styles.complaintCard}>
          <Text style={styles.sectionTitle}>Что произошло?</Text>
          <TextInput
            value={complaintReason}
            onChangeText={setComplaintReason}
            placeholder="Например: не приехал, не позвонил"
            style={styles.input}
          />
          <TextInput
            value={complaintComment}
            onChangeText={setComplaintComment}
            placeholder="Подробности (необязательно)"
            multiline
            numberOfLines={3}
            style={[styles.input, styles.textArea]}
          />
          <View style={styles.actionsRow}>
            <Pressable onPress={() => setShowComplaint(false)} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Отмена</Text>
            </Pressable>
            <Pressable
              onPress={() => complainMutation.mutate()}
              disabled={complaintReason.trim().length < 3 || complainMutation.isPending}
              style={[
                styles.dangerButton,
                styles.flex1,
                (complaintReason.trim().length < 3 || complainMutation.isPending) && styles.disabled,
              ]}
            >
              <Text style={styles.dangerText}>
                {complainMutation.isPending ? 'Отправляем...' : 'Отправить жалобу'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </Screen>
  );
}

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  searchContainer: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 32,
  },
  pulseWrap: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.accent,
  },
  pulseRingInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  pulseCore: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  muted: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  elapsed: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.accentDark,
    fontVariant: ['tabular-nums'],
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: colors.accent,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 17,
  },
  successButton: {
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#E5F4EE',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BDDDC8',
  },
  successText: {
    color: colors.success,
    fontWeight: '700',
  },
  dangerButton: {
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#FFF4F0',
    borderWidth: 1,
    borderColor: '#E7B5A9',
    alignItems: 'center',
  },
  dangerText: {
    color: '#C55B3C',
    fontWeight: '700',
  },
  assignedCard: {
    alignItems: 'center',
    gap: 6,
    padding: 24,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  assignedTitle: {
    color: colors.muted,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  assignedName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  complaintCard: {
    gap: 10,
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  input: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F8F5EF',
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: '#FFF0E5',
    alignItems: 'center',
  },
  secondaryText: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  flex1: { flex: 1 },
  disabled: { opacity: 0.5 },
});
