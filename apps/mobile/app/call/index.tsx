import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ServiceCategory, ServiceCallItem } from '@stomvp/shared';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { getCategoryIcon } from '../../src/constants/category-meta';
import { colors } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/auth-store';
import { type Coordinates, getDeviceCoordinates } from '../../src/utils/device-location';

const TASHKENT_CENTER: Coordinates = {
  latitude: 41.2995,
  longitude: 69.2401,
};

export default function CallMasterScreen() {
  const session = useAuthStore((state) => state.session);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [coords, setCoords] = useState<Coordinates>(TASHKENT_CENTER);
  const [coordsResolved, setCoordsResolved] = useState(false);
  const [phone, setPhone] = useState(session?.user.phone ?? '');
  const [description, setDescription] = useState('');

  // Pull current location once on mount so the call lands at the user's
  // actual position by default. Falls back silently to Tashkent center.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getDeviceCoordinates(TASHKENT_CENTER);
      if (cancelled) return;
      if (result.coordinates) {
        setCoords(result.coordinates);
      }
      setCoordsResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<ServiceCategory[]>('/categories');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ServiceCallItem>('/service-calls', {
        categoryId,
        lat: coords.latitude,
        lng: coords.longitude,
        clientPhone: phone.trim(),
        description: description.trim() || undefined,
      });
      return data;
    },
    onSuccess: (call) => {
      router.replace(`/call/${call.id}`);
    },
    onError: (err) => {
      const message =
        axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : 'Не удалось создать вызов. Попробуйте ещё раз.';
      Alert.alert('Ошибка', message);
    },
  });

  const canSubmit = useMemo(
    () =>
      Boolean(categoryId) &&
      phone.trim().length >= 5 &&
      coordsResolved &&
      !createMutation.isPending,
    [categoryId, phone, coordsResolved, createMutation.isPending],
  );

  return (
    <Screen>
      <Text style={styles.title}>Срочный вызов мастера</Text>
      <Text style={styles.subtitle}>
        Выберите услугу — ближайший доступный мастер позвонит вам в течение нескольких минут.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Какая услуга нужна?</Text>
        {categoriesQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {(categoriesQuery.data ?? []).map((category) => {
              const active = categoryId === category.id;
              const icon = getCategoryIcon(category.slug);
              return (
                <Pressable
                  key={category.id}
                  onPress={() => setCategoryId(category.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Ionicons
                    name={icon as any}
                    size={20}
                    color={active ? '#FFFFFF' : colors.accentDark}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{category.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Куда приехать?</Text>
        <Text style={styles.muted}>
          {coordsResolved
            ? 'По умолчанию — ваша текущая геопозиция. Уточнить точку можно на карте.'
            : 'Определяем геопозицию...'}
        </Text>
        <View style={styles.coordsCard}>
          <Ionicons name="location" size={18} color={colors.accentDark} />
          <Text style={styles.coordsValue}>
            {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
          </Text>
        </View>
        <Pressable
          onPress={async () => {
            const result = await getDeviceCoordinates(TASHKENT_CENTER);
            if (result.coordinates) {
              setCoords(result.coordinates);
            }
          }}
          style={styles.secondaryButton}
        >
          <Ionicons name="locate" size={18} color={colors.accentDark} />
          <Text style={styles.secondaryText}>Где я сейчас</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Куда позвонить мастеру?</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="+998 90 123 45 67"
          keyboardType="phone-pad"
          style={styles.input}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Что случилось? (необязательно)</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Например: не заводится, нужна электрика"
          multiline
          numberOfLines={3}
          style={[styles.input, styles.textArea]}
        />
      </View>

      <Pressable
        onPress={() => createMutation.mutate()}
        disabled={!canSubmit}
        style={[styles.primaryButton, !canSubmit && styles.disabled]}
      >
        {createMutation.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
            <Text style={styles.primaryText}>Вызвать мастера</Text>
          </>
        )}
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    color: colors.muted,
    lineHeight: 20,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
  },
  chipRow: {
    gap: 10,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFF1E7',
    borderWidth: 1,
    borderColor: '#F1D1BC',
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  coordsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coordsValue: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  input: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 18,
    backgroundColor: '#D75A43',
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
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#FFF0E5',
  },
  secondaryText: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
});
