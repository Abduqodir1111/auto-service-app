import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { AuthPayload } from '@stomvp/shared';
import { AppLogo } from '../../components/app-logo';
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
    defaultValues: {
      phone: '',
      password: '',
    },
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
    if (!loginMutation.isError) {
      return null;
    }

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
      <View style={styles.hero}>
        <AppLogo />
        <Text style={styles.eyebrow}>MasterTop</Text>
        <Text style={styles.title}>Найдите ближайшее СТО без лишних звонков</Text>
        <Text style={styles.subtitle}>
          Каталог мастерских, заявки, избранное и управление профилем мастера в одном приложении.
        </Text>
      </View>

      <View style={styles.card}>
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <Field
              label="Телефон"
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
          style={styles.button}
        >
          <Text style={styles.buttonText}>
            {loginMutation.isPending ? 'Входим...' : 'Войти'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.push('/(auth)/sign-up')}>
          <Text style={styles.link}>Создать аккаунт клиента или мастера</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 10,
    marginTop: 24,
  },
  eyebrow: {
    color: colors.accentDark,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 12,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
  },
  card: {
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 16,
  },
  button: {
    borderRadius: 20,
    backgroundColor: colors.accent,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
  },
  link: {
    color: colors.accentDark,
    textAlign: 'center',
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
  },
});
