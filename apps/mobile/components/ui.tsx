import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../src/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

type ButtonVariant = 'primary' | 'success' | 'secondary' | 'ghost' | 'danger';

type AppButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  compact?: boolean;
  accessibilityLabel?: string;
};

const buttonColors: Record<ButtonVariant, { background: string; text: string; border: string }> = {
  primary: { background: colors.accent, text: '#FFFFFF', border: colors.accent },
  success: { background: colors.success, text: '#FFFFFF', border: colors.success },
  secondary: { background: '#FFF0E5', text: colors.accentDark, border: '#F1D1BC' },
  ghost: { background: colors.card, text: colors.text, border: colors.border },
  danger: { background: colors.danger, text: '#FFFFFF', border: colors.danger },
};

export function AppButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  fullWidth = true,
  compact,
  accessibilityLabel,
}: AppButtonProps) {
  const palette = buttonColors[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          minHeight: compact ? 44 : 50,
          paddingHorizontal: compact ? spacing.md : spacing.lg,
          borderRadius: compact ? radius.md : radius.lg,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={palette.text} /> : null}
          <Text style={[styles.buttonText, { color: palette.text }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

type EmptyStateProps = {
  icon: IconName;
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, text, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={24} color={colors.accentDark} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {actionLabel && onAction ? (
        <AppButton label={actionLabel} icon="search-outline" onPress={onAction} variant="secondary" />
      ) : null}
    </View>
  );
}

type RetryStateProps = {
  title?: string;
  text?: string;
  onRetry: () => void;
  loading?: boolean;
};

export function RetryState({
  title = 'Не удалось загрузить данные',
  text = 'Проверьте интернет и попробуйте ещё раз.',
  onRetry,
  loading,
}: RetryStateProps) {
  return (
    <View style={styles.emptyCard}>
      <View style={[styles.emptyIcon, styles.warningIcon]}>
        <Ionicons name="cloud-offline-outline" size={24} color={colors.warning} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      <AppButton
        label="Повторить"
        icon="refresh-outline"
        onPress={onRetry}
        loading={loading}
        variant="secondary"
      />
    </View>
  );
}

export function NetworkBanner() {
  return (
    <View style={styles.networkBanner}>
      <Ionicons name="wifi-outline" size={18} color={colors.warning} />
      <Text style={styles.networkText}>Нет связи с сервером. Проверьте интернет.</Text>
    </View>
  );
}

type StatusPillProps = {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
};

export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  return (
    <View style={[styles.statusPill, styles[`statusPill_${tone}`]]}>
      <Text style={[styles.statusText, styles[`statusText_${tone}`]]}>{label}</Text>
    </View>
  );
}

type SectionCardProps = {
  title?: string;
  children: ReactNode;
};

export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <View style={styles.sectionCard}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonText: {
    ...typography.button,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.55,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0E5',
  },
  warningIcon: {
    backgroundColor: '#FFF7DD',
  },
  emptyTitle: {
    ...typography.sectionTitle,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.muted,
    textAlign: 'center',
  },
  networkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#FFF7DD',
    borderWidth: 1,
    borderColor: '#EEDDAB',
  },
  networkText: {
    flex: 1,
    color: colors.text,
    fontWeight: '700',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusPill_neutral: {
    backgroundColor: '#F6F7F8',
  },
  statusPill_success: {
    backgroundColor: '#EAF4F1',
  },
  statusPill_warning: {
    backgroundColor: '#FFF7DD',
  },
  statusPill_danger: {
    backgroundColor: '#FFF4F0',
  },
  statusText_neutral: {
    color: colors.muted,
  },
  statusText_success: {
    color: colors.success,
  },
  statusText_warning: {
    color: '#8D6514',
  },
  statusText_danger: {
    color: colors.danger,
  },
  sectionCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    ...typography.sectionTitle,
  },
});
