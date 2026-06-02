import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { Field } from '../../components/field';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { usePasswordResetStore } from '../../src/store/password-reset-store';
import { isLikelyPhone, normalizePhoneForApi } from '../../src/utils/phone';
import { useResponsive } from '../../src/utils/responsive';

const schema = z.object({
  phone: z.string().refine(isLikelyPhone, 'Введите телефон в формате +998 90 123 45 67'),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const setPhone = usePasswordResetStore((state) => state.setPhone);
  const layout = useResponsive();
  const compact = layout.isSmallPhone;
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '' },
  });

  const requestMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const phone = normalizePhoneForApi(values.phone);
      await api.post('/auth/password-reset/request-code', {
        phone,
      });
      return phone;
    },
    onSuccess: (phone) => {
      setPhone(phone);
      router.push('/(auth)/forgot-password-verify');
    },
  });

  const errorMessage = (() => {
    if (!requestMutation.isError) return null;
    if (axios.isAxiosError(requestMutation.error)) {
      const message = requestMutation.error.response?.data?.message;
      return typeof message === 'string'
        ? message
        : 'Не удалось отправить SMS-код. Попробуйте ещё раз.';
    }
    return 'Не удалось отправить SMS-код. Попробуйте ещё раз.';
  })();

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
          Восстановление пароля
        </Text>
        <Text style={styles.subtitle}>
          Введите номер телефона. Если аккаунт существует, мы отправим SMS-код для
          подтверждения.
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

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable
          onPress={handleSubmit((values) => requestMutation.mutate(values))}
          style={({ pressed }) => [
            styles.button,
            {
              borderRadius: compact ? 16 : 18,
              paddingVertical: compact ? 14 : 16,
            },
            pressed && styles.buttonPressed,
            requestMutation.isPending && styles.buttonDisabled,
          ]}
          disabled={requestMutation.isPending}
        >
          <Text style={styles.buttonText}>
            {requestMutation.isPending ? 'Отправляем...' : 'Получить SMS-код'}
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
