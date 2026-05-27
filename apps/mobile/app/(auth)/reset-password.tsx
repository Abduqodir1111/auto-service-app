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
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>

      <View style={{ gap: compact ? 6 : 8 }}>
        <Text
          style={[
            styles.title,
            {
              marginTop: compact ? 2 : 10,
              fontSize: layout.font(32, 0.18, 28, 34),
              lineHeight: layout.font(38, 0.18, 34, 40),
            },
          ]}
        >
          Новый пароль
        </Text>
        <Text style={styles.subtitle}>
          Придумайте новый пароль для номера {phone}. После сохранения можно будет
          войти с новым паролем.
        </Text>
      </View>

      <View
        style={[
          styles.card,
          {
            borderRadius: compact ? 20 : 24,
            padding: compact ? 14 : 18,
            gap: compact ? 12 : 14,
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

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable
          onPress={handleSubmit((values) => resetMutation.mutate(values))}
          style={({ pressed }) => [
            styles.button,
            {
              borderRadius: compact ? 16 : 18,
              paddingVertical: compact ? 14 : 16,
            },
            pressed && styles.buttonPressed,
            resetMutation.isPending && styles.buttonDisabled,
          ]}
          disabled={resetMutation.isPending}
        >
          <Text style={styles.buttonText}>
            {resetMutation.isPending ? 'Сохраняем...' : 'Сохранить пароль'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.8,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
  },
  button: {
    marginTop: 6,
    borderRadius: 18,
    backgroundColor: colors.success,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
});
