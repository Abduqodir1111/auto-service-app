import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { AuthPayload } from '@stomvp/shared';
import { Field } from '../../components/field';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/auth-store';
import { isLikelyPhone, normalizePhoneForApi } from '../../src/utils/phone';
import { useResponsive } from '../../src/utils/responsive';

const schema = z.object({
  phone: z.string().refine(isLikelyPhone, 'Введите телефон в формате +998 90 123 45 67'),
  password: z.string().min(6, 'Минимум 6 символов'),
});

type FormValues = z.infer<typeof schema>;

export default function SignInScreen() {
  const setSession = useAuthStore((state) => state.setSession);
  const layout = useResponsive();
  const compact = layout.isSmallPhone;
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '', password: '' },
  });

  const loginMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data } = await api.post<AuthPayload>('/auth/login', {
        ...values,
        phone: normalizePhoneForApi(values.phone),
      });
      return data;
    },
    onSuccess: async (payload) => {
      await setSession(payload);
      router.replace('/(tabs)');
    },
  });

  const loginErrorMessage = (() => {
    if (!loginMutation.isError) return null;
    if (axios.isAxiosError(loginMutation.error)) {
      const apiMessage = loginMutation.error.response?.data?.message;
      if (typeof apiMessage === 'string') {
        return apiMessage === 'Invalid credentials'
          ? 'Не удалось войти. Проверьте номер в формате +998 и пароль.'
          : apiMessage;
      }
      return 'Нет связи с сервером. Проверьте Wi-Fi и доступность API.';
    }
    return 'Не удалось войти. Попробуйте ещё раз.';
  })();

  return (
    <Screen
      style={[
        styles.screen,
        {
          gap: compact ? 12 : 14,
          paddingTop: compact ? 6 : 10,
          paddingBottom: compact ? 18 : 24,
        },
      ]}
    >
      <ImageBackground
        source={require('../../assets/auth-hero.png')}
        imageStyle={styles.heroImage}
        style={[
          styles.hero,
          {
            height: compact ? 344 : 386,
            borderRadius: compact ? 28 : 34,
          },
        ]}
      >
        <View style={styles.heroWash} />
        <View style={styles.heroShade} />

        <View style={styles.heroContent}>
          <View style={styles.brandRow}>
            <Image source={require('../../assets/icon.png')} style={styles.logo} />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.brandName, { fontSize: layout.font(32, 0.2, 28, 34) }]}
            >
              Master<Text style={styles.brandAccent}>Top</Text>
            </Text>
          </View>

          <Text
            style={[
              styles.heroTitle,
              {
                fontSize: layout.font(23, 0.22, 20, 25),
                lineHeight: layout.font(29, 0.18, 26, 31),
              },
            ]}
          >
            Найдите ближайшее СТО за несколько минут
          </Text>

          <View style={styles.heroMark}>
            <View style={styles.heroMarkLine} />
            <Ionicons name="location" size={30} color={colors.accent} />
          </View>
        </View>
      </ImageBackground>

      <View
        style={[
          styles.formCard,
          {
            marginTop: compact ? -64 : -76,
            borderRadius: compact ? 26 : 30,
            padding: compact ? 16 : 18,
            gap: compact ? 10 : 12,
          },
        ]}
      >
        <View style={styles.formHeader}>
          <Text style={[styles.formTitle, { fontSize: layout.font(27, 0.2, 24, 30) }]}>
            Вход в аккаунт
          </Text>
          <Text style={styles.formSubtitle}>Введите номер телефона и пароль</Text>
        </View>

        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <Field
              label="Телефон"
              icon="call-outline"
              placeholder="+998 90 123 45 67"
              keyboardType="phone-pad"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.phone?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <Field
              label="Пароль"
              icon="lock-closed-outline"
              placeholder="Минимум 6 символов"
              secureTextEntry
              value={field.value}
              onChangeText={field.onChange}
              error={errors.password?.message}
            />
          )}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Восстановить пароль"
          hitSlop={8}
          onPress={() => router.push('/(auth)/forgot-password')}
          style={styles.forgotButton}
        >
          <Text style={styles.forgotText}>Забыли пароль?</Text>
        </Pressable>

        {loginErrorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.error}>{loginErrorMessage}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Войти в аккаунт"
          onPress={handleSubmit((values) => loginMutation.mutate(values))}
          style={({ pressed }) => [
            styles.loginButton,
            pressed && styles.buttonPressed,
            loginMutation.isPending && styles.buttonDisabled,
          ]}
          disabled={loginMutation.isPending}
        >
          <Text style={styles.loginButtonText}>
            {loginMutation.isPending ? 'Входим...' : 'Войти'}
          </Text>
          <View style={styles.loginArrow}>
            <Ionicons name="arrow-forward" size={24} color={colors.accent} />
          </View>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>или</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Создать новый аккаунт"
          onPress={() => router.push('/(auth)/sign-up')}
          style={({ pressed }) => [styles.createButton, pressed && styles.buttonPressed]}
        >
          <Ionicons name="person-add-outline" size={19} color={colors.success} />
          <Text style={styles.createText}>Создать аккаунт</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.trustRow}>
        <View style={styles.trustItem}>
          <View style={styles.trustIcon}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.success} />
          </View>
          <Text style={styles.trustText}>Проверенные мастера</Text>
        </View>
        <View style={styles.trustDivider} />
        <View style={styles.trustItem}>
          <View style={styles.trustIconWarm}>
            <Ionicons name="time-outline" size={22} color={colors.accent} />
          </View>
          <Text style={styles.trustText}>Быстрый отклик</Text>
        </View>
        <View style={styles.trustDivider} />
        <View style={styles.trustItem}>
          <View style={styles.trustIcon}>
            <Ionicons name="pricetag-outline" size={22} color={colors.success} />
          </View>
          <Text style={styles.trustText}>Понятные цены</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: 24,
  },
  hero: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceWarm,
    justifyContent: 'flex-start',
    shadowColor: '#2B1B12',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 7,
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 246, 235, 0.2)',
  },
  heroShade: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '66%',
    backgroundColor: 'rgba(255, 249, 240, 0.76)',
  },
  heroContent: {
    paddingTop: 30,
    paddingHorizontal: 22,
    width: '72%',
  },
  brandRow: {
    gap: 8,
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 14,
  },
  brandName: {
    marginTop: 8,
    color: '#091A2C',
    fontWeight: '900',
    letterSpacing: 0,
  },
  brandAccent: {
    color: colors.accent,
  },
  heroTitle: {
    marginTop: 12,
    color: '#091A2C',
    fontWeight: '900',
    letterSpacing: 0,
  },
  heroMark: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroMarkLine: {
    width: 88,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
    transform: [{ rotate: '-5deg' }],
  },
  formCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.86)',
    shadowColor: '#15201D',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 30,
    elevation: 8,
  },
  formHeader: {
    gap: 6,
  },
  formTitle: {
    color: colors.text,
    fontWeight: '900',
    letterSpacing: 0,
  },
  formSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  forgotText: {
    color: colors.accentDark,
    fontSize: 14,
    fontWeight: '900',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.surfaceDanger,
    borderWidth: 1,
    borderColor: colors.borderDanger,
  },
  error: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  loginButton: {
    minHeight: 56,
    borderRadius: 22,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  loginArrow: {
    position: 'absolute',
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  createButton: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  createText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  trustRow: {
    marginHorizontal: 20,
    marginTop: 2,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
    shadowColor: '#1A241F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
  },
  trustIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceSuccess,
    borderWidth: 1,
    borderColor: colors.borderSuccess,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustIconWarm: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustText: {
    color: colors.text,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  trustDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 6,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
