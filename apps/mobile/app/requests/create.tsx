import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text } from 'react-native';
import { z } from 'zod';
import { Field } from '../../components/field';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';

const schema = z.object({
  customerName: z.string().min(2, 'Введите имя'),
  customerPhone: z.string().min(6, 'Введите телефон'),
  carModel: z.string().optional(),
  issueDescription: z.string().min(10, 'Опишите проблему подробнее'),
  preferredDate: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function CreateRequestScreen() {
  const params = useLocalSearchParams<{ workshopId: string }>();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      await api.post('/applications', {
        ...values,
        workshopId: params.workshopId,
      });
    },
    onSuccess: () => {
      router.replace('/(tabs)/requests');
    },
  });

  return (
    <Screen>
      <Text style={styles.title}>Новая заявка</Text>
      <Controller
        control={control}
        name="customerName"
        render={({ field }) => (
          <Field
            label="Ваше имя"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.customerName?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="customerPhone"
        render={({ field }) => (
          <Field
            label="Телефон"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.customerPhone?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="carModel"
        render={({ field }) => (
          <Field label="Автомобиль" value={field.value} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="issueDescription"
        render={({ field }) => (
          <Field
            label="Что случилось"
            multiline
            value={field.value}
            onChangeText={field.onChange}
            error={errors.issueDescription?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="preferredDate"
        render={({ field }) => (
          <Field
            label="Желаемая дата (ISO)"
            value={field.value}
            onChangeText={field.onChange}
          />
        )}
      />
      <Pressable
        onPress={handleSubmit((values) => createMutation.mutate(values))}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Отправить</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  button: {
    backgroundColor: colors.success,
    borderRadius: 18,
    alignItems: 'center',
    paddingVertical: 16,
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
  },
});
