import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { WebView } from 'react-native-webview';
import { ServiceCategory, ServiceCallItem } from '@stomvp/shared';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { getCategoryIcon } from '../../src/constants/category-meta';
import { colors } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/auth-store';
import { useMapPickerStore } from '../../src/store/map-picker-store';
import { type Coordinates, getDeviceCoordinates } from '../../src/utils/device-location';
import { createLeafletHtml } from '../../src/utils/leaflet-html';

const TASHKENT_CENTER: Coordinates = {
  latitude: 41.2995,
  longitude: 69.2401,
};

export default function CallMasterScreen() {
  const session = useAuthStore((state) => state.session);
  const setPickerInitialLocation = useMapPickerStore((state) => state.setPickerInitialLocation);
  const selectedLocation = useMapPickerStore((state) => state.selectedLocation);
  const clearPickerStore = useMapPickerStore((state) => state.clear);

  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [coords, setCoords] = useState<Coordinates>(TASHKENT_CENTER);
  const [coordsResolved, setCoordsResolved] = useState(false);
  const [phone, setPhone] = useState(session?.user.phone ?? '');
  const [description, setDescription] = useState('');
  const lastConsumedPickerTsRef = useRef<number | null>(null);

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

  // When the map-picker screen pops back with a new selection, apply it.
  useEffect(() => {
    if (!selectedLocation) return;
    if (lastConsumedPickerTsRef.current === selectedLocation.updatedAt) return;
    lastConsumedPickerTsRef.current = selectedLocation.updatedAt;
    setCoords({
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
    });
    setCoordsResolved(true);
  }, [selectedLocation]);

  useEffect(() => () => clearPickerStore(), [clearPickerStore]);

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

  const mapPreviewHtml = useMemo(
    () =>
      createLeafletHtml({
        latitude: coords.latitude,
        longitude: coords.longitude,
        interactive: false,
        title: 'Сюда вызываем мастера',
      }),
    [coords.latitude, coords.longitude],
  );

  const openMapPicker = () => {
    setPickerInitialLocation({
      latitude: coords.latitude,
      longitude: coords.longitude,
      updatedAt: Date.now(),
    });
    router.push('/map/picker');
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="flash" size={28} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.heroTitle}>Срочный вызов мастера</Text>
          <Text style={styles.heroSubtitle}>
            Ближайший доступный мастер позвонит вам и приедет к указанной точке.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionLabel}>
          <View style={styles.sectionNumber}>
            <Text style={styles.sectionNumberText}>1</Text>
          </View>
          <Text style={styles.sectionTitle}>Какая услуга нужна?</Text>
        </View>
        {categoriesQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
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
                    name={icon}
                    size={18}
                    color={active ? '#FFFFFF' : colors.accentDark}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionLabel}>
          <View style={styles.sectionNumber}>
            <Text style={styles.sectionNumberText}>2</Text>
          </View>
          <Text style={styles.sectionTitle}>Куда приехать?</Text>
        </View>

        <Pressable onPress={openMapPicker} style={styles.mapCard}>
          <WebView
            originWhitelist={['*']}
            source={{ html: mapPreviewHtml }}
            style={styles.mapPreview}
            pointerEvents="none"
          />
          <View style={styles.mapOverlay}>
            <View style={styles.mapEditBadge}>
              <Ionicons name="pencil" size={14} color="#FFFFFF" />
              <Text style={styles.mapEditBadgeText}>Изменить на карте</Text>
            </View>
          </View>
        </Pressable>

        <Pressable
          onPress={async () => {
            const result = await getDeviceCoordinates(TASHKENT_CENTER);
            if (result.coordinates) {
              setCoords(result.coordinates);
            } else if (result.permissionDenied) {
              Alert.alert(
                'Нет доступа к геопозиции',
                'Разрешите доступ к локации, чтобы быстро поставить точку рядом с вами.',
              );
            }
          }}
          style={styles.locateRow}
        >
          <Ionicons name="locate" size={18} color={colors.accentDark} />
          <Text style={styles.locateText}>Поставить мою текущую точку</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionLabel}>
          <View style={styles.sectionNumber}>
            <Text style={styles.sectionNumberText}>3</Text>
          </View>
          <Text style={styles.sectionTitle}>Куда позвонить?</Text>
        </View>
        <View style={styles.inputShell}>
          <Ionicons name="call-outline" size={18} color={colors.muted} />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+998 90 123 45 67"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionLabel}>
          <View style={styles.sectionNumber}>
            <Text style={styles.sectionNumberText}>4</Text>
          </View>
          <Text style={styles.sectionTitle}>Что случилось?</Text>
          <Text style={styles.optionalTag}>необязательно</Text>
        </View>
        <View style={[styles.inputShell, styles.inputShellMultiline]}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Например: не заводится, нужна электрика"
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
            style={[styles.input, styles.textArea]}
          />
        </View>
      </View>

      <Pressable
        onPress={() => createMutation.mutate()}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && canSubmit && styles.primaryButtonPressed,
          !canSubmit && styles.disabled,
        ]}
      >
        {createMutation.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="flash" size={20} color="#FFFFFF" />
            <Text style={styles.primaryText}>Вызвать мастера</Text>
          </>
        )}
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 24,
    backgroundColor: '#FFE3D0',
    borderWidth: 1,
    borderColor: '#F1D1BC',
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#D75A43',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D75A43',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },

  section: {
    gap: 10,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  sectionNumberText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  optionalTag: {
    marginLeft: 'auto',
    color: colors.muted,
    fontSize: 12,
    fontStyle: 'italic',
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

  mapCard: {
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  mapPreview: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  mapEditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mapEditBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  locateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locateText: {
    color: colors.accentDark,
    fontWeight: '700',
    fontSize: 14,
  },

  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  inputShellMultiline: {
    alignItems: 'flex-start',
    paddingTop: 12,
    minHeight: 100,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 22,
    backgroundColor: '#D75A43',
    marginTop: 8,
    shadowColor: '#D75A43',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
});
