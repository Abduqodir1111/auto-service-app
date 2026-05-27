import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Field } from '../../components/field';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { usePasswordResetStore } from '../../src/store/password-reset-store';
import { useResponsive } from '../../src/utils/responsive';

type VerifyCodeResponse = {
  verificationToken: string;
  expiresIn: number;
};

export default function ForgotPasswordVerifyScreen() {
  const phone = usePasswordResetStore((state) => state.phone);
  const setVerificationToken = usePasswordResetStore((state) => state.setVerificationToken);
  const layout = useResponsive();
  const compact = layout.isSmallPhone;
  const [smsCode, setSmsCode] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!phone) {
      router.replace('/(auth)/forgot-password');
    }
  }, [phone]);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!phone) {
        throw new Error('missing-phone');
      }

      const { data } = await api.post<VerifyCodeResponse>(
        '/auth/password-reset/verify-code',
        {
          phone,
          code: smsCode,
        },
      );

      return data;
    },
    onSuccess: (data) => {
      setVerificationToken(data.verificationToken);
      router.push('/(auth)/reset-password');
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
      if (!phone) {
        throw new Error('missing-phone');
      }

      await api.post('/auth/password-reset/request-code', {
        phone,
      });
    },
    onSuccess: () => {
      setErrorMessage(null);
      setSmsCode('');
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

  if (!phone) {
    return null;
  }

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
          Введите SMS-код
        </Text>
        <Text style={styles.subtitle}>
          Мы отправили 5-значный код на номер {phone}. После проверки можно будет
          задать новый пароль.
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
        <Field
          label="Код из SMS"
          value={smsCode}
          onChangeText={(value) => {
            setSmsCode(value.replace(/\D/g, '').slice(0, 5));
            setErrorMessage(null);
          }}
          keyboardType="number-pad"
          maxLength={5}
          autoFocus
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          importantForAutofill="yes"
        />

        <Pressable
          onPress={() => {
            if (smsCode.trim().length !== 5) {
              setErrorMessage('Введите 5-значный код из SMS');
              return;
            }

            verifyMutation.mutate();
          }}
          style={[
            styles.button,
            {
              borderRadius: compact ? 16 : 18,
              paddingVertical: compact ? 14 : 16,
            },
            verifyMutation.isPending && styles.buttonDisabled,
          ]}
          disabled={verifyMutation.isPending}
        >
          <Text style={styles.buttonText}>
            {verifyMutation.isPending ? 'Проверяем...' : 'Подтвердить код'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => resendMutation.mutate()}
          style={[
            styles.secondaryButton,
            {
              borderRadius: compact ? 16 : 18,
              paddingVertical: compact ? 12 : 14,
            },
            resendMutation.isPending && styles.buttonDisabled,
          ]}
          disabled={resendMutation.isPending}
        >
          <Text style={styles.secondaryButtonText}>
            {resendMutation.isPending ? 'Отправляем...' : 'Отправить код ещё раз'}
          </Text>
        </Pressable>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
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
