import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { router } from 'expo-router';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { UserRole } from '@stomvp/shared';
import { Field } from '../../components/field';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { usePendingSignUpStore } from '../../src/store/pending-sign-up-store';
import { track } from '../../src/utils/analytics';

const schema = z
  .object({
    fullName: z.string().min(2, 'Введите имя'),
    phone: z.string().min(6, 'Введите телефон'),
    password: z.string().min(6, 'Минимум 6 символов'),
    confirmPassword: z.string().min(6, 'Повторите пароль'),
    role: z.nativeEnum(UserRole),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;
type RequestCodeResponse = {
  success: boolean;
  expiresIn: number;
  resendIn: number;
};

export default function SignUpScreen() {
  const pendingPayload = usePendingSignUpStore((state) => state.payload);
  const setPendingPayload = usePendingSignUpStore((state) => state.setPayload);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: pendingPayload?.fullName ?? '',
      phone: pendingPayload?.phone ?? '',
      password: pendingPayload?.password ?? '',
      confirmPassword: pendingPayload?.password ?? '',
      role: pendingPayload?.role ?? UserRole.CLIENT,
    },
  });

  const role = watch('role');

  const requestCodeMutation = useMutation({
    mutationFn: async (value: { phone: string }) => {
      const { data } = await api.post<RequestCodeResponse>('/auth/register/request-code', value);
      return data;
    },
    onSuccess: () => {
      setRequestError(null);
      // Fire signup_started only after the SMS gateway confirms — counts
      // real funnel entries, not idle keystrokes on a half-filled form.
      track('signup_started', { role: watch('role') });
      router.push('/(auth)/sign-up-verify');
    },
    onError: (error) => {
      if (!axios.isAxiosError(error)) {
        setRequestError('Не удалось отправить SMS-код');
        return;
      }
      const message = error.response?.data?.message;
      setRequestError(typeof message === 'string' ? message : 'Не удалось отправить SMS-код');
    },
  });

  return (
    <Screen>
      <View style={styles.heroWrap}>
        <Text style={styles.heroTitle}>Регистрация</Text>
        <Text style={styles.heroSubtitle}>
          Заполните данные — пришлём 5-значный код на ваш номер.
        </Text>
      </View>

      {/* Role chip switcher — visually loud since it changes downstream UX
          (client vs master). Active chip has tinted background + accent ring. */}
      <View style={styles.roleRow}>
        {[UserRole.CLIENT, UserRole.MASTER].map((value) => {
          const isActive = role === value;
          return (
            <Pressable
              key={value}
              onPress={() => setValue('role', value)}
              style={[styles.roleChip, isActive && styles.roleChipActive]}
            >
              <Ionicons
                name={value === UserRole.CLIENT ? 'person-outline' : 'construct-outline'}
                size={20}
                color={isActive ? colors.accentDark : colors.muted}
              />
              <Text style={[styles.roleText, isActive && styles.roleTextActive]}>
                {value === UserRole.CLIENT ? 'Я клиент' : 'Я мастер / СТО'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        <Controller
          control={control}
          name="fullName"
          render={({ field }) => (
            <Field
              label="Имя"
              icon="person-outline"
              placeholder="Ваше имя"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.fullName?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <Field
              label="Телефон"
              icon="call-outline"
              placeholder="+998 90 123 45 67"
              value={field.value}
              onChangeText={field.onChange}
              keyboardType="phone-pad"
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
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field }) => (
            <Field
              label="Подтвердите пароль"
              icon="lock-closed-outline"
              placeholder="Введите пароль ещё раз"
              secureTextEntry
              value={field.value}
              onChangeText={field.onChange}
              error={errors.confirmPassword?.message}
            />
          )}
        />

        {requestError ? <Text style={styles.error}>{requestError}</Text> : null}

        <Pressable
          onPress={handleSubmit((values) => {
            setPendingPayload({
              fullName: values.fullName,
              phone: values.phone,
              password: values.password,
              role: values.role,
            });
            requestCodeMutation.mutate({ phone: values.phone });
          })}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
            requestCodeMutation.isPending && styles.buttonDisabled,
          ]}
          disabled={requestCodeMutation.isPending}
        >
          <Ionicons name="send" size={18} color="#FFFFFF" style={styles.btnIcon} />
          <Text style={styles.primaryButtonText}>
            {requestCodeMutation.isPending ? 'Отправляем SMS...' : 'Зарегистрироваться'}
          </Text>
        </Pressable>
      </View>

      {/* Backlink to login — for users who landed here but already have
          an account. Quiet, doesn't compete with the primary CTA. */}
      <Pressable onPress={() => router.back()} style={styles.backlinkWrap}>
        <Text style={styles.backlinkText}>
          Уже есть аккаунт?{' '}
          <Text style={styles.backlinkAccent}>Войти</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    marginTop: 20,
    marginBottom: 18,
    gap: 6,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },

  roleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: colors.card,
  },
  roleChipActive: {
    backgroundColor: '#FFF0E5',
    borderColor: colors.accent,
  },
  roleText: {
    textAlign: 'center',
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  roleTextActive: {
    color: colors.accentDark,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
  },

  primaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    borderRadius: 20,
    backgroundColor: colors.success,
    paddingVertical: 16,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  btnIcon: {
    marginRight: 8,
  },
  buttonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.5 },

  backlinkWrap: {
    marginTop: 20,
    alignItems: 'center',
  },
  backlinkText: {
    color: colors.muted,
    fontSize: 14,
  },
  backlinkAccent: {
    color: colors.accentDark,
    fontWeight: '700',
  },

  error: {
    color: colors.danger,
    fontSize: 13,
    marginLeft: 4,
  },
});
