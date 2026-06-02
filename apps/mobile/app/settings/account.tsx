import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Field } from '../../components/field';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { showConfirm, showError, showSuccess } from '../../src/store/feedback-store';
import { useAuthStore } from '../../src/store/auth-store';
import { useResponsive } from '../../src/utils/responsive';

function getApiErrorMessage(error: unknown, fallback: string) {
  const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
  return typeof message === 'string' ? message : fallback;
}

export default function AccountSettingsScreen() {
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const setSession = useAuthStore((state) => state.setSession);
  const layout = useResponsive();
  const compact = layout.isSmallPhone;
  const [smsCode, setSmsCode] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);

  const requestCodeMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/account-delete/request-code');
    },
    onSuccess: () => {
      setCodeRequested(true);
      setSmsCode('');
      showSuccess('SMS отправлено', `Код подтверждения отправлен на ${session?.user.phone}.`);
    },
    onError: (error) => {
      showError(
        'Не удалось отправить SMS',
        getApiErrorMessage(error, 'Проверьте подключение и попробуйте ещё раз.'),
      );
    },
  });

  const confirmDeleteMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/account-delete/confirm', {
        code: smsCode.trim(),
      });
    },
    onSuccess: async () => {
      queryClient.clear();
      await setSession(null);
      router.replace('/(auth)/sign-in');
      showSuccess('Аккаунт удалён', 'Ваш аккаунт и связанные данные удалены с сервера.');
    },
    onError: (error) => {
      showError(
        'Не удалось удалить аккаунт',
        getApiErrorMessage(error, 'Проверьте SMS-код и попробуйте ещё раз.'),
      );
    },
  });

  const canConfirm = codeRequested && smsCode.trim().length >= 4 && !confirmDeleteMutation.isPending;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />

      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>

      <View style={styles.header}>
        <Text style={[styles.title, { fontSize: layout.font(30, 0.2, 26, 32) }]}>
          Управление аккаунтом
        </Text>
        <Text style={styles.subtitle}>
          Удаление спрятано глубже и требует SMS-код на номер аккаунта, чтобы его нельзя было
          нажать случайно.
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
        <View style={styles.warningIcon}>
          <Ionicons name="warning-outline" size={28} color={colors.danger} />
        </View>
        <Text style={styles.sectionTitle}>Удаление аккаунта</Text>
        <Text style={styles.muted}>
          Профиль, объявления, фото, заявки, отзывы и избранное будут удалены без возможности
          восстановления.
        </Text>
        <Text style={styles.phoneLine}>Номер для подтверждения: {session?.user.phone}</Text>

        <Pressable
          disabled={requestCodeMutation.isPending}
          onPress={() => requestCodeMutation.mutate()}
          style={[
            styles.secondaryButton,
            requestCodeMutation.isPending && styles.disabledButton,
          ]}
        >
          <Text style={styles.secondaryText}>
            {requestCodeMutation.isPending
              ? 'Отправляем SMS...'
              : codeRequested
                ? 'Отправить код ещё раз'
                : 'Получить SMS-код'}
          </Text>
        </Pressable>

        {codeRequested ? (
          <>
            <Field
              label="Код из SMS"
              value={smsCode}
              onChangeText={(value) => setSmsCode(value.replace(/\D/g, '').slice(0, 8))}
              keyboardType="number-pad"
              maxLength={8}
              autoFocus
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              importantForAutofill="yes"
            />

            <Pressable
              disabled={!canConfirm}
              onPress={() =>
                showConfirm({
                  title: 'Удалить аккаунт?',
                  message: 'После подтверждения аккаунт и связанные данные будут удалены навсегда.',
                  confirmLabel: 'Удалить',
                  destructive: true,
                  onConfirm: () => confirmDeleteMutation.mutate(),
                })
              }
              style={[styles.deleteButton, !canConfirm && styles.disabledButton]}
            >
              <Text style={styles.deleteText}>
                {confirmDeleteMutation.isPending ? 'Удаляем...' : 'Удалить аккаунт'}
              </Text>
            </Pressable>
          </>
        ) : null}
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
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#F1B3A7',
  },
  warningIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF4F0',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  muted: {
    color: colors.muted,
    lineHeight: 20,
  },
  phoneLine: {
    color: colors.text,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#FFF0E5',
  },
  secondaryText: {
    color: colors.accentDark,
    fontWeight: '800',
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: colors.danger,
  },
  deleteText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.55,
  },
});
