import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthPayload } from '@stomvp/shared';
import { Field } from '../../components/field';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/auth-store';
import { usePendingSignUpStore } from '../../src/store/pending-sign-up-store';

type VerifyCodeResponse = {
  verificationToken: string;
  expiresIn: number;
};

export default function SignUpVerifyScreen() {
  const setSession = useAuthStore((state) => state.setSession);
  const pendingPayload = usePendingSignUpStore((state) => state.payload);
  const clearPendingPayload = usePendingSignUpStore((state) => state.clear);
  const [smsCode, setSmsCode] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!pendingPayload) {
      router.replace('/(auth)/sign-up');
    }
  }, [pendingPayload]);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!pendingPayload) {
        throw new Error('missing-payload');
      }

      const verifyResponse = await api.post<VerifyCodeResponse>('/auth/register/verify-code', {
        phone: pendingPayload.phone,
        code: smsCode,
      });

      const registerResponse = await api.post<AuthPayload>('/auth/register', {
        fullName: pendingPayload.fullName,
        phone: pendingPayload.phone,
        password: pendingPayload.password,
        role: pendingPayload.role,
        verificationToken: verifyResponse.data.verificationToken,
      });

      return registerResponse.data;
    },
    onSuccess: async (payload) => {
      clearPendingPayload();
      await setSession(payload);
      router.replace('/(tabs)');
    },
    onError: (error) => {
      if (!axios.isAxiosError(error)) {
        setErrorMessage('Не удалось подтвердить код');
        return;
      }

      const message = error.response?.data?.message;
      setErrorMessage(typeof message === 'string' ? message : 'Не удалось подтвердить код');
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      if (!pendingPayload) {
        throw new Error('missing-payload');
      }

      await api.post('/auth/register/request-code', {
        phone: pendingPayload.phone,
      });
    },
    onSuccess: () => {
      setErrorMessage(null);
    },
    onError: (error) => {
      if (!axios.isAxiosError(error)) {
        setErrorMessage('Не удалось отправить код повторно');
        return;
      }

      const message = error.response?.data?.message;
      setErrorMessage(
        typeof message === 'string' ? message : 'Не удалось отправить код повторно',
      );
    },
  });

  if (!pendingPayload) {
    return null;
  }

  return (
    <Screen>
      <View style={{ gap: 8 }}>
        <Text style={styles.title}>Подтвердите номер</Text>
        <Text style={styles.subtitle}>
          Мы отправили 5-значный SMS-код на номер {pendingPayload.phone}. Введите его,
          чтобы завершить регистрацию.
        </Text>
      </View>

      <View style={styles.card}>
        <Field
          label="Код из SMS"
          value={smsCode}
          onChangeText={(value) => {
            setSmsCode(value.replace(/\D/g, '').slice(0, 5));
            setErrorMessage(null);
          }}
          keyboardType="number-pad"
          maxLength={5}
        />

        <Pressable
          onPress={() => {
            if (smsCode.trim().length !== 5) {
              setErrorMessage('Введите 5-значный код из SMS');
              return;
            }

            verifyMutation.mutate();
          }}
          style={[styles.button, verifyMutation.isPending && styles.buttonDisabled]}
          disabled={verifyMutation.isPending}
        >
          <Text style={styles.buttonText}>
            {verifyMutation.isPending ? 'Проверяем код...' : 'Подтвердить и войти'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => resendMutation.mutate()}
          style={[styles.secondaryButton, resendMutation.isPending && styles.buttonDisabled]}
          disabled={resendMutation.isPending}
        >
          <Text style={styles.secondaryButtonText}>
            {resendMutation.isPending ? 'Отправляем...' : 'Отправить код ещё раз'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>Изменить данные</Text>
        </Pressable>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
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
  secondaryButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: '#FFF4EC',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    color: colors.muted,
    fontWeight: '600',
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
