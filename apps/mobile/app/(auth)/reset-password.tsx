import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { router } from 'expo-router';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { Field } from '../../components/field';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { usePasswordResetStore } from '../../src/store/password-reset-store';
import { useResponsive } from '../../src/utils/responsive';

const schema = z
  .object({
    newPassword: z.string().min(6, 'Минимум 6 символов'),
    confirmPassword: z.string().min(6, 'Повторите пароль'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 12 || !digits.startsWith('998')) {
    return phone;
  }

  return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
}

export default function ResetPasswordScreen() {
  const phone = usePasswordResetStore((state) => state.phone);
  const verificationToken = usePasswordResetStore((state) => state.verificationToken);
  const clearReset = usePasswordResetStore((state) => state.clear);
  const layout = useResponsive();
  const compact = layout.isSmallPhone;
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  React.useEffect(() => {
    if (!phone || !verificationToken) {
      router.replace('/(auth)/forgot-password');
    }
  }, [phone, verificationToken]);

  const resetMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!phone || !verificationToken) {
        throw new Error('missing-reset-session');
      }

      await api.post('/auth/password-reset/confirm', {
        phone,
        newPassword: values.newPassword,
        verificationToken,
      });
    },
    onSuccess: () => {
      clearReset();
      router.replace('/(auth)/sign-in');
    },
  });

  const errorMessage = (() => {
    if (!resetMutation.isError) return null;
    if (axios.isAxiosError(resetMutation.error)) {
      const message = resetMutation.error.response?.data?.message;
      return typeof message === 'string'
        ? message
        : 'Не удалось сохранить новый пароль.';
    }
    return 'Не удалось сохранить новый пароль.';
  })();

  if (!phone || !verificationToken) {
    return null;
  }

  return (
    <Screen
      style={[
        styles.screen,
        {
          gap: compact ? 12 : 14,
          paddingTop: compact ? 12 : 16,
          paddingBottom: compact ? 18 : 24,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Назад"
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <Ionicons name="chevron-back" size={25} color="#091A2C" />
      </Pressable>

      <View style={styles.successHero}>
        <View style={styles.successHalo}>
          <Ionicons name="checkmark" size={48} color="#FFFFFF" />
        </View>
      </View>

      <View style={styles.copy}>
        <Text
          style={[
            styles.title,
            {
              fontSize: layout.font(30, 0.2, 27, 32),
              lineHeight: layout.font(36, 0.16, 33, 38),
            },
          ]}
        >
          Новый пароль
        </Text>
        <Text style={styles.subtitle}>
          Код подтверждён для номера{' '}
          <Text style={styles.phoneAccent}>{formatPhone(phone)}</Text>. Задайте новый пароль.
        </Text>
      </View>

      <View
        style={[
          styles.card,
          {
            borderRadius: compact ? 24 : 28,
            padding: compact ? 14 : 16,
            gap: compact ? 11 : 13,
          },
        ]}
      >
        <Controller
          control={control}
          name="newPassword"
          render={({ field }) => (
            <Field
              label="Новый пароль"
              icon="lock-closed-outline"
              placeholder="Минимум 6 символов"
              secureTextEntry
              value={field.value}
              onChangeText={field.onChange}
              error={errors.newPassword?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field }) => (
            <Field
              label="Повторите пароль"
              icon="shield-checkmark-outline"
              placeholder="Повторите новый пароль"
              secureTextEntry
              value={field.value}
              onChangeText={field.onChange}
              error={errors.confirmPassword?.message}
            />
          )}
        />

        <View style={styles.safeCard}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.success} />
          <Text style={styles.safeText}>Пароль не сохраняется в открытом виде</Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.error}>{errorMessage}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Сохранить новый пароль"
          onPress={handleSubmit((values) => resetMutation.mutate(values))}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            resetMutation.isPending && styles.buttonDisabled,
          ]}
          disabled={resetMutation.isPending}
        >
          <Text style={styles.buttonText}>
            {resetMutation.isPending ? 'Сохраняем...' : 'Сохранить пароль'}
          </Text>
          <Ionicons name="arrow-forward" size={23} color="#FFFFFF" />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A241F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  successHero: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successHalo: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 26,
    elevation: 8,
  },
  copy: {
    alignItems: 'center',
    gap: 9,
  },
  title: {
    color: '#091A2C',
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
    textAlign: 'center',
  },
  phoneAccent: {
    color: colors.accent,
    fontWeight: '900',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#15201D',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.1,
    shadowRadius: 26,
    elevation: 6,
  },
  safeCard: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: colors.surfaceSuccess,
    borderWidth: 1,
    borderColor: colors.borderSuccess,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  safeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
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
  button: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 6,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
});
