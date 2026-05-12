import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { AuthPayload } from '@stomvp/shared';
import { Field } from '../../components/field';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/auth-store';

const schema = z.object({
  phone: z.string().min(6, 'Введите телефон'),
  password: z.string().min(6, 'Минимум 6 символов'),
});

type FormValues = z.infer<typeof schema>;

export default function SignInScreen() {
  const setSession = useAuthStore((state) => state.setSession);
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
      const { data } = await api.post<AuthPayload>('/auth/login', values);
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
          ? 'Не удалось войти. Проверьте телефон и пароль.'
          : apiMessage;
      }
      return 'Нет связи с сервером. Проверьте Wi-Fi и доступность API.';
    }
    return 'Не удалось войти. Попробуйте ещё раз.';
  })();

  return (
    <Screen>
      <View style={styles.brandWrap}>
        <Text style={styles.brandName}>MasterTop</Text>
        <View style={styles.brandUnderline} />
      </View>

      {/* Primary CTA at the TOP: most new users tap this first. Green to
          stand out against the orange accent of the secondary "Войти". */}
      <Pressable
        onPress={() => router.push('/(auth)/sign-up')}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Ionicons name="person-add" size={18} color="#FFFFFF" style={styles.btnIcon} />
        <Text style={styles.primaryButtonText}>Создать аккаунт</Text>
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>или войти</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.card}>
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

        {loginErrorMessage ? (
          <Text style={styles.error}>{loginErrorMessage}</Text>
        ) : null}

        <Pressable
          onPress={handleSubmit((values) => loginMutation.mutate(values))}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
            loginMutation.isPending && styles.buttonDisabled,
          ]}
          disabled={loginMutation.isPending}
        >
          <Ionicons name="log-in-outline" size={18} color="#FFFFFF" style={styles.btnIcon} />
          <Text style={styles.secondaryButtonText}>
            {loginMutation.isPending ? 'Входим...' : 'Войти'}
          </Text>
        </Pressable>
      </View>

      {/* Marketing footer — quiet, contextual, no longer competing with
          the form for first attention. */}
      <View style={styles.footer}>
        <Text style={styles.footerEyebrow}>MasterTop · Поиск СТО рядом</Text>
        <Text style={styles.footerTitle}>
          Найдите ближайшее СТО без лишних звонков
        </Text>
        <Text style={styles.footerSubtitle}>
          Каталог мастерских, заявки, избранное и управление профилем
          мастера — в одном приложении.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandWrap: {
    marginTop: 36,
    marginBottom: 28,
    alignItems: 'center',
    gap: 10,
  },
  brandName: {
    fontSize: 46,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: -1.4,
    textShadowColor: 'rgba(216, 104, 42, 0.25)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  brandUnderline: {
    width: 56,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },

  primaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: colors.success,
    paddingVertical: 18,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
  },
  secondaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: colors.accent,
    paddingVertical: 15,
    marginTop: 6,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 3,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  btnIcon: {
    marginRight: 8,
  },
  buttonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.5 },

  footer: {
    marginTop: 28,
    paddingHorizontal: 4,
    gap: 6,
  },
  footerEyebrow: {
    color: colors.accentDark,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 11,
    fontWeight: '700',
  },
  footerTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: colors.text,
  },
  footerSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },

  error: {
    color: colors.danger,
    fontSize: 13,
    marginLeft: 4,
  },
});
