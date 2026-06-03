import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { usePasswordResetStore } from '../../src/store/password-reset-store';
import { useResponsive } from '../../src/utils/responsive';

type VerifyCodeResponse = {
  verificationToken: string;
  expiresIn: number;
};

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 12 || !digits.startsWith('998')) {
    return phone;
  }

  return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
}

function formatTimer(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  return `00:${String(safeSeconds).padStart(2, '0')}`;
}

export default function ForgotPasswordVerifyScreen() {
  const phone = usePasswordResetStore((state) => state.phone);
  const setVerificationToken = usePasswordResetStore((state) => state.setVerificationToken);
  const layout = useResponsive();
  const compact = layout.isSmallPhone;
  const codeInputRef = React.useRef<TextInput>(null);
  const [smsCode, setSmsCode] = React.useState('');
  const [resendIn, setResendIn] = React.useState(30);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!phone) {
      router.replace('/(auth)/forgot-password');
    }
  }, [phone]);

  React.useEffect(() => {
    if (resendIn <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendIn((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendIn]);

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
      setResendIn(30);
      codeInputRef.current?.focus();
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

  const displayPhone = formatPhone(phone);

  return (
    <Screen
      style={[
        styles.screen,
        {
          gap: compact ? 18 : 22,
          paddingTop: compact ? 12 : 16,
          paddingBottom: compact ? 18 : 24,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Назад"
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <Ionicons name="chevron-back" size={25} color="#091A2C" />
      </Pressable>

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
          Введите код
        </Text>
        <Text style={styles.subtitle}>
          Мы отправили SMS с кодом на номер{' '}
          <Text style={styles.phoneAccent}>{displayPhone}</Text>
        </Text>
      </View>

      <View style={styles.codeArea}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ввести SMS-код"
          onPress={() => codeInputRef.current?.focus()}
          style={[styles.codeRow, { gap: compact ? 8 : 10 }]}
        >
          {Array.from({ length: 5 }).map((_, index) => {
            const digit = smsCode[index] ?? '';
            const active = index === smsCode.length || (smsCode.length === 5 && index === 4);

            return (
              <View
                key={index}
                style={[
                  styles.codeBox,
                  {
                    width: compact ? 50 : 56,
                    height: compact ? 58 : 64,
                    borderRadius: compact ? 14 : 16,
                  },
                  active && styles.codeBoxActive,
                  digit && styles.codeBoxFilled,
                ]}
              >
                <Text style={styles.codeDigit}>{digit}</Text>
              </View>
            );
          })}
        </Pressable>

        <TextInput
          ref={codeInputRef}
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
          style={styles.hiddenInput}
        />
      </View>

      <View style={styles.resendWrap}>
        {resendIn > 0 ? (
          <Text style={styles.resendText}>
            Отправить код повторно через{' '}
            <Text style={styles.timerText}>{formatTimer(resendIn)}</Text>
          </Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Отправить код повторно"
            onPress={() => resendMutation.mutate()}
            disabled={resendMutation.isPending}
            style={({ pressed }) => [styles.resendButton, pressed && styles.buttonPressed]}
          >
            <Ionicons name="refresh-outline" size={17} color={colors.accent} />
            <Text style={styles.resendButtonText}>
              {resendMutation.isPending ? 'Отправляем...' : 'Отправить код повторно'}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.helpCard}>
        <Ionicons name="help-circle-outline" size={20} color={colors.accent} />
        <View style={styles.helpCopy}>
          <Text style={styles.helpTitle}>Не получили код?</Text>
          <Text style={styles.helpText}>Проверьте номер или запросите код снова.</Text>
        </View>
      </View>

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.error}>{errorMessage}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Подтвердить SMS-код"
        onPress={() => {
          if (smsCode.trim().length !== 5) {
            setErrorMessage('Введите 5-значный код из SMS');
            return;
          }

          verifyMutation.mutate();
        }}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          verifyMutation.isPending && styles.buttonDisabled,
        ]}
        disabled={verifyMutation.isPending}
      >
        <Text style={styles.buttonText}>
          {verifyMutation.isPending ? 'Проверяем...' : 'Подтвердить код'}
        </Text>
        <Ionicons name="arrow-forward" size={23} color="#FFFFFF" />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A241F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  copy: {
    gap: 9,
  },
  title: {
    color: '#091A2C',
    fontWeight: '900',
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
  },
  phoneAccent: {
    color: colors.accent,
    fontWeight: '900',
  },
  codeArea: {
    position: 'relative',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  codeBox: {
    borderWidth: 1.4,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A241F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  codeBoxActive: {
    borderColor: colors.accent,
  },
  codeBoxFilled: {
    backgroundColor: colors.card,
  },
  codeDigit: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '900',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  resendWrap: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  timerText: {
    color: colors.accent,
    fontWeight: '900',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  resendButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '900',
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    backgroundColor: colors.surfaceWarm,
  },
  helpCopy: {
    flex: 1,
    gap: 4,
  },
  helpTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  helpText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
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
});
