import { zodResolver } from '@hookform/resolvers/zod';
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
    onSuccess: (_, variables, context) => {
      setRequestError(null);
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
      <View style={{ gap: 8 }}>
        <Text style={styles.title}>Создать аккаунт</Text>
        <Text style={styles.subtitle}>
          Заполните данные, затем мы отправим 5-значный код на ваш номер и
          откроем следующий шаг подтверждения.
        </Text>
      </View>

      <View style={styles.roleRow}>
        {[UserRole.CLIENT, UserRole.MASTER].map((value) => (
          <Pressable
            key={value}
            onPress={() => setValue('role', value)}
            style={[styles.roleChip, role === value && styles.roleChipActive]}
          >
            <Text style={[styles.roleText, role === value && styles.roleTextActive]}>
              {value === UserRole.CLIENT ? 'Я клиент' : 'Я мастер / СТО'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <Controller
          control={control}
          name="fullName"
          render={({ field }) => (
            <Field
              label="Имя"
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
              secureTextEntry
              value={field.value}
              onChangeText={field.onChange}
              error={errors.confirmPassword?.message}
            />
          )}
        />

        <Pressable
          onPress={handleSubmit((values) => {
            setPendingPayload({
              fullName: values.fullName,
              phone: values.phone,
              password: values.password,
              role: values.role,
            });

            requestCodeMutation.mutate({
              phone: values.phone,
            });
          })}
          style={[styles.button, requestCodeMutation.isPending && styles.buttonDisabled]}
          disabled={requestCodeMutation.isPending}
        >
          <Text style={styles.buttonText}>
            {requestCodeMutation.isPending ? 'Отправляем SMS...' : 'Зарегистрироваться'}
          </Text>
        </Pressable>

        {requestError ? <Text style={styles.error}>{requestError}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    marginTop: 16,
  },
  subtitle: {
    color: colors.muted,
    lineHeight: 20,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
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
  button: {
    marginTop: 8,
    borderRadius: 18,
    backgroundColor: colors.success,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
