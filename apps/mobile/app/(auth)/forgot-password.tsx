import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
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
    <Screen
      style={[
        styles.screen,
        {
          gap: compact ? 12 : 14,
          paddingTop: compact ? 8 : 12,
          paddingBottom: compact ? 18 : 24,
        },
      ]}
    >
      <View
        style={[
          styles.shell,
          {
            borderRadius: compact ? 26 : 30,
          },
        ]}
      >
        <ImageBackground
          source={require('../../assets/auth-hero.png')}
          imageStyle={styles.heroImage}
          style={[
            styles.hero,
            {
              height: compact ? 196 : 216,
            },
          ]}
        >
          <View style={styles.heroWash} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Назад"
            hitSlop={10}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={25} color="#091A2C" />
          </Pressable>
        </ImageBackground>

        <View
          style={[
            styles.content,
            {
              padding: compact ? 14 : 16,
              gap: compact ? 12 : 14,
            },
          ]}
        >
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
              Восстановление доступа
            </Text>
            <Text style={styles.subtitle}>
              Введите номер телефона. Мы отправим SMS-код для подтверждения.
            </Text>
          </View>

          <View style={styles.formCard}>
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
          </View>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.error}>{errorMessage}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Получить SMS-код"
            onPress={handleSubmit((values) => requestMutation.mutate(values))}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              requestMutation.isPending && styles.buttonDisabled,
            ]}
            disabled={requestMutation.isPending}
          >
            <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>
              {requestMutation.isPending ? 'Отправляем...' : 'Получить код'}
            </Text>
          </Pressable>

          <View style={styles.timeHint}>
            <Ionicons name="time-outline" size={17} color={colors.muted} />
            <Text style={styles.timeHintText}>Код обычно приходит в течение 30 секунд</Text>
          </View>

          <View style={styles.safeHint}>
            <Ionicons name="lock-closed-outline" size={17} color={colors.success} />
            <Text style={styles.safeHintText}>Ваши данные защищены</Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: 24,
  },
  shell: {
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(24, 33, 32, 0.1)',
    shadowColor: '#1A241F',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
  },
  hero: {
    justifyContent: 'flex-start',
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 246, 237, 0.14)',
  },
  backButton: {
    marginLeft: 16,
    marginTop: 16,
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A241F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.11,
    shadowRadius: 16,
    elevation: 3,
  },
  content: {
    backgroundColor: '#FFFFFF',
  },
  copy: {
    gap: 7,
  },
  title: {
    color: '#091A2C',
    fontWeight: '900',
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  formCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 10,
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
  timeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  timeHintText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  safeHint: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: colors.surfaceSuccess,
    borderWidth: 1,
    borderColor: colors.borderSuccess,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  safeHintText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
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
});
