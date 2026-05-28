import { Ionicons } from '@expo/vector-icons';
import { SupportTicketType } from '@stomvp/shared';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Field } from '../../components/field';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/auth-store';
import { useResponsive } from '../../src/utils/responsive';

const typeLabels: Record<SupportTicketType, string> = {
  [SupportTicketType.SUGGESTION]: 'Предложение',
  [SupportTicketType.COMPLAINT]: 'Жалоба',
};

function getApiErrorMessage(error: unknown) {
  const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
  return typeof message === 'string'
    ? message
    : 'Не удалось отправить обращение. Проверьте интернет и попробуйте ещё раз.';
}

export default function SupportSettingsScreen() {
  const session = useAuthStore((state) => state.session);
  const layout = useResponsive();
  const compact = layout.isSmallPhone;
  const [type, setType] = useState<SupportTicketType>(SupportTicketType.SUGGESTION);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post('/support/tickets', {
        type,
        message: message.trim(),
        contactPhone: session?.user.phone,
      });
    },
    onSuccess: () => {
      setMessage('');
      setNotice('Обращение отправлено. Администратор увидит его в панели поддержки.');
    },
    onError: (error) => {
      Alert.alert('Ошибка', getApiErrorMessage(error));
    },
  });

  const canSubmit = message.trim().length >= 5 && !mutation.isPending;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />

      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>

      <View style={styles.header}>
        <Text style={[styles.title, { fontSize: layout.font(30, 0.2, 26, 32) }]}>
          Поддержка
        </Text>
        <Text style={styles.subtitle}>
          Отправьте предложение или жалобу. Сообщение попадёт администратору в панель.
        </Text>
      </View>

      <View
        style={[
          styles.card,
          {
            borderRadius: compact ? 20 : 24,
            padding: compact ? 14 : 18,
          },
        ]}
      >
        <View style={styles.typeRow}>
          {Object.values(SupportTicketType).map((value) => {
            const active = type === value;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  setType(value);
                  setNotice(null);
                }}
                style={[styles.typeChip, active && styles.typeChipActive]}
              >
                <Ionicons
                  name={value === SupportTicketType.SUGGESTION ? 'bulb-outline' : 'warning-outline'}
                  size={18}
                  color={active ? '#FFFFFF' : colors.accentDark}
                />
                <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                  {typeLabels[value]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Field
          label="Сообщение"
          multiline
          placeholder="Опишите идею, проблему или жалобу"
          value={message}
          onChangeText={(value) => {
            setMessage(value);
            setNotice(null);
          }}
          maxLength={2000}
        />

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Pressable
          disabled={!canSubmit}
          onPress={() => mutation.mutate()}
          style={[
            styles.primaryButton,
            { borderRadius: compact ? 16 : 18, paddingVertical: compact ? 14 : 16 },
            !canSubmit && styles.disabledButton,
          ]}
        >
          <Text style={styles.primaryText}>
            {mutation.isPending ? 'Отправляем...' : 'Отправить'}
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
  header: {
    gap: 8,
  },
  title: {
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    color: colors.muted,
    lineHeight: 21,
  },
  card: {
    gap: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#FFF0E5',
  },
  typeChipActive: {
    backgroundColor: colors.accent,
  },
  typeChipText: {
    color: colors.accentDark,
    fontWeight: '800',
  },
  typeChipTextActive: {
    color: '#FFFFFF',
  },
  notice: {
    color: colors.success,
    fontWeight: '700',
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.success,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.55,
  },
});
