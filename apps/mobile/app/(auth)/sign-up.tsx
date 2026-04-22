import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { AuthPayload, UserRole } from '@stomvp/shared';
import { Field } from '../../components/field';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/auth-store';

const schema = z.object({
  fullName: z.string().min(2, 'Введите имя'),
  phone: z.string().min(6, 'Введите телефон'),
  email: z.string().email('Некорректный email').optional().or(z.literal('')),
  password: z.string().min(6, 'Минимум 6 символов'),
  role: z.nativeEnum(UserRole),
});

type FormValues = z.infer<typeof schema>;

export default function SignUpScreen() {
  const setSession = useAuthStore((state) => state.setSession);
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: UserRole.CLIENT,
    },
  });

  const role = watch('role');

  const registerMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data } = await api.post<AuthPayload>('/auth/register', {
        ...values,
        email: values.email || undefined,
      });
      return data;
    },
    onSuccess: async (payload) => {
      await setSession(payload);
      router.replace('/(tabs)');
    },
  });

  return (
    <Screen>
      <View style={{ gap: 8 }}>
        <Text style={styles.title}>Создать аккаунт</Text>
        <Text style={styles.subtitle}>
          Клиент ищет сервисы, мастер создаёт и ведёт карточку СТО.
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
              error={errors.phone?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Field
              label="Email"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.email?.message}
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

        <Pressable
          onPress={handleSubmit((values) => registerMutation.mutate(values))}
          style={styles.button}
        >
          <Text style={styles.buttonText}>
            {registerMutation.isPending ? 'Создаём...' : 'Создать аккаунт'}
          </Text>
        </Pressable>
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
});
