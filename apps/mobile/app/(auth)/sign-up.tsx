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
import { isLikelyPhone, normalizePhoneForApi } from '../../src/utils/phone';
import { useResponsive } from '../../src/utils/responsive';

const schema = z
  .object({
    fullName: z.string().min(2, 'Введите имя'),
    phone: z.string().refine(isLikelyPhone, 'Введите телефон в формате +998 90 123 45 67'),
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
  const { isSmallPhone: compact } = useResponsive();
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
      const { data } = await api.post<RequestCodeResponse>('/auth/register/request-code', {
        phone: normalizePhoneForApi(value.phone),
      });
      return data;
    },
    onSuccess: () => {
      setRequestError(null);
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
    <Screen
      style={[
        styles.screen,
        {
          gap: compact ? 10 : 12,
          paddingTop: compact ? 10 : 14,
          paddingBottom: compact ? 18 : 24,
        },
      ]}
    >
      <Text style={styles.rolePrompt}>Вы регистрируетесь как:</Text>

      <View style={[styles.roleRow, { gap: compact ? 8 : 10 }]}>
        {[UserRole.CLIENT, UserRole.MASTER].map((value) => {
          const isActive = role === value;
          const isClient = value === UserRole.CLIENT;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={isClient ? 'Зарегистрироваться как клиент' : 'Зарегистрироваться как мастер или СТО'}
              onPress={() => setValue('role', value, { shouldValidate: true })}
              style={({ pressed }) => [
                styles.roleCard,
                {
                  borderRadius: compact ? 18 : 20,
                  padding: compact ? 12 : 14,
                },
                isActive && styles.roleCardActive,
                pressed && styles.buttonPressed,
              ]}
            >
              <View style={[styles.roleIcon, isActive && styles.roleIconActive]}>
                <Ionicons
                  name={isClient ? 'person-outline' : 'construct-outline'}
                  size={26}
                  color={isActive ? colors.success : colors.accent}
                />
              </View>
              <View style={styles.roleCopy}>
                <Text style={styles.roleTitle}>
                  {isClient ? 'Я клиент' : 'Я мастер / СТО'}
                </Text>
                <Text style={styles.roleSubtitle}>
                  {isClient ? 'Ищу услуги и мастеров' : 'Предоставляю услуги'}
                </Text>
              </View>
              {isActive ? (
                <View style={styles.roleCheck}>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.formCard,
          {
            borderRadius: compact ? 26 : 30,
            padding: compact ? 14 : 16,
            gap: compact ? 10 : 11,
          },
        ]}
      >
        <Controller
          control={control}
          name="fullName"
          render={({ field }) => (
            <Field
              label="Ваше имя"
              icon="person-outline"
              placeholder="Введите ваше имя"
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

        <View style={styles.privacyCard}>
          <View style={styles.privacyIcon}>
            <Ionicons name="shield-checkmark-outline" size={25} color={colors.accent} />
          </View>
          <View style={styles.privacyCopy}>
            <Text style={styles.privacyTitle}>Ваши данные под защитой</Text>
            <Text style={styles.privacyText}>
              Мы не передаём данные третьим лицам и используем их только для работы сервиса.
            </Text>
          </View>
        </View>

        {requestError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.error}>{requestError}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Зарегистрироваться"
          onPress={handleSubmit((values) => {
            const phone = normalizePhoneForApi(values.phone);
            setPendingPayload({
              fullName: values.fullName,
              phone,
              password: values.password,
              role: values.role,
            });
            requestCodeMutation.mutate({ phone });
          })}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.buttonPressed,
            requestCodeMutation.isPending && styles.buttonDisabled,
          ]}
          disabled={requestCodeMutation.isPending}
        >
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.submitText}>
            {requestCodeMutation.isPending ? 'Отправляем SMS...' : 'Зарегистрироваться'}
          </Text>
          <View style={styles.submitArrow}>
            <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Войти в существующий аккаунт"
        onPress={() => router.back()}
        style={styles.loginLink}
      >
        <Text style={styles.loginLinkText}>
          Уже есть аккаунт? <Text style={styles.loginLinkAccent}>Войти</Text>
        </Text>
      </Pressable>

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
            <Ionicons name="flash-outline" size={22} color={colors.accent} />
          </View>
          <Text style={styles.trustText}>Быстрый отклик</Text>
        </View>
        <View style={styles.trustDivider} />
        <View style={styles.trustItem}>
          <View style={styles.trustIconCool}>
            <Ionicons name="pricetag-outline" size={22} color="#4F46E5" />
          </View>
          <Text style={styles.trustText}>Прозрачные цены</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: 24,
  },
  rolePrompt: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  roleRow: {
    flexDirection: 'row',
  },
  roleCard: {
    flex: 1,
    minHeight: 104,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#1A241F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  roleCardActive: {
    borderColor: '#6FCF8F',
    backgroundColor: '#F7FFF9',
  },
  roleIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconActive: {
    backgroundColor: colors.surfaceSuccess,
  },
  roleCopy: {
    flex: 1,
    gap: 5,
  },
  roleTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  roleSubtitle: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  roleCheck: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#15201D',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.11,
    shadowRadius: 28,
    elevation: 7,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.borderWarm,
  },
  privacyIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyCopy: {
    flex: 1,
    gap: 5,
  },
  privacyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  privacyText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
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
  submitButton: {
    minHeight: 58,
    borderRadius: 20,
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
  submitText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    maxWidth: '82%',
  },
  submitArrow: {
    position: 'absolute',
    right: 16,
  },
  loginLink: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  loginLinkText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  loginLinkAccent: {
    color: colors.accent,
    fontWeight: '900',
  },
  trustRow: {
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
  trustIconCool: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#DDE3FF',
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
