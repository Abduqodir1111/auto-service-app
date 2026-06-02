import { Ionicons } from '@expo/vector-icons';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../src/constants/theme';
import { useFeedbackStore } from '../src/store/feedback-store';
import type { FeedbackActionVariant, ToastTone } from '../src/store/feedback-store';
import { useNetworkStore } from '../src/store/network-store';
import { triggerImpact, triggerSuccess, triggerWarning } from '../src/utils/linking-actions';

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
  secondary: { background: colors.surfaceWarm, text: colors.accentDark, border: colors.borderWarm },
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
      onPress={() => {
        void triggerImpact();
        onPress?.();
      }}
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

export function GlobalNetworkBanner() {
  const isOffline = useNetworkStore((state) => state.isOffline);

  if (!isOffline) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.globalNetworkBanner}>
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
      <Text style={styles.globalNetworkText}>
        Нет связи с сервером. Показываем то, что уже есть на экране.
      </Text>
    </View>
  );
}

const toastToneStyles: Record<ToastTone, { icon: IconName; background: string; border: string; iconColor: string }> = {
  success: {
    icon: 'checkmark-circle-outline',
    background: 'rgba(234, 244, 241, 0.98)',
    border: colors.borderSuccess,
    iconColor: colors.success,
  },
  warning: {
    icon: 'warning-outline',
    background: 'rgba(255, 247, 221, 0.98)',
    border: colors.borderWarning,
    iconColor: colors.warning,
  },
  danger: {
    icon: 'alert-circle-outline',
    background: 'rgba(255, 244, 240, 0.98)',
    border: colors.borderDanger,
    iconColor: colors.danger,
  },
  info: {
    icon: 'information-circle-outline',
    background: 'rgba(255, 253, 249, 0.98)',
    border: colors.border,
    iconColor: colors.accentDark,
  },
};

const actionVariantMap: Record<FeedbackActionVariant, ButtonVariant> = {
  primary: 'primary',
  secondary: 'secondary',
  ghost: 'ghost',
  danger: 'danger',
};

export function FeedbackHost() {
  const toast = useFeedbackStore((state) => state.toast);
  const confirm = useFeedbackStore((state) => state.confirm);
  const actionSheet = useFeedbackStore((state) => state.actionSheet);
  const hideToast = useFeedbackStore((state) => state.hideToast);
  const hideConfirm = useFeedbackStore((state) => state.hideConfirm);
  const hideActionSheet = useFeedbackStore((state) => state.hideActionSheet);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = setTimeout(() => {
      useFeedbackStore.getState().hideToast();
    }, 3200);

    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    if (toast.tone === 'success') {
      void triggerSuccess();
      return;
    }

    if (toast.tone === 'warning' || toast.tone === 'danger') {
      void triggerWarning();
    }
  }, [toast]);

  useEffect(() => {
    if (confirm || actionSheet) {
      void triggerImpact();
    }
  }, [confirm, actionSheet]);

  const palette = toast ? toastToneStyles[toast.tone] : null;

  return (
    <>
      {toast && palette ? (
        <Pressable
          onPress={hideToast}
          style={[
            styles.toast,
            {
              backgroundColor: palette.background,
              borderColor: palette.border,
            },
          ]}
          accessibilityRole="alert"
        >
          <Ionicons name={palette.icon} size={22} color={palette.iconColor} />
          <View style={styles.toastCopy}>
            <Text style={styles.toastTitle}>{toast.title}</Text>
            {toast.message ? <Text style={styles.toastMessage}>{toast.message}</Text> : null}
          </View>
        </Pressable>
      ) : null}

      <Modal
        visible={Boolean(confirm)}
        transparent
        animationType="fade"
        onRequestClose={hideConfirm}
      >
        <View style={styles.confirmBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={hideConfirm} />
          <View style={styles.confirmCard}>
            <View style={[styles.emptyIcon, confirm?.destructive && styles.dangerIcon]}>
              <Ionicons
                name={confirm?.destructive ? 'warning-outline' : 'help-circle-outline'}
                size={24}
                color={confirm?.destructive ? colors.danger : colors.accentDark}
              />
            </View>
            <Text style={styles.confirmTitle}>{confirm?.title}</Text>
            {confirm?.message ? <Text style={styles.confirmText}>{confirm.message}</Text> : null}
            <View style={styles.confirmActions}>
              <AppButton
                label={confirm?.cancelLabel ?? 'Отмена'}
                variant="ghost"
                compact
                onPress={hideConfirm}
              />
              <AppButton
                label={confirm?.confirmLabel ?? 'Подтвердить'}
                variant={confirm?.destructive ? 'danger' : 'primary'}
                compact
                onPress={() => {
                  const onConfirm = confirm?.onConfirm;
                  hideConfirm();
                  onConfirm?.();
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(actionSheet)}
        transparent
        animationType="fade"
        onRequestClose={hideActionSheet}
      >
        <View style={styles.confirmBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={hideActionSheet} />
          <View style={styles.confirmCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="apps-outline" size={24} color={colors.accentDark} />
            </View>
            <Text style={styles.confirmTitle}>{actionSheet?.title}</Text>
            {actionSheet?.message ? <Text style={styles.confirmText}>{actionSheet.message}</Text> : null}
            <View style={styles.confirmActions}>
              {actionSheet?.actions.map((action) => (
                <AppButton
                  key={action.label}
                  label={action.label}
                  variant={actionVariantMap[action.variant ?? 'primary']}
                  compact
                  onPress={() => {
                    hideActionSheet();
                    action.onPress();
                  }}
                />
              ))}
              <AppButton
                label={actionSheet?.cancelLabel ?? 'Отмена'}
                variant="ghost"
                compact
                onPress={hideActionSheet}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    backgroundColor: colors.surfaceWarm,
  },
  warningIcon: {
    backgroundColor: colors.surfaceWarning,
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
    backgroundColor: colors.surfaceWarning,
    borderWidth: 1,
    borderColor: colors.borderWarning,
  },
  networkText: {
    flex: 1,
    color: colors.text,
    fontWeight: '700',
  },
  globalNetworkBanner: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255, 247, 221, 0.96)',
    borderWidth: 1,
    borderColor: colors.borderWarning,
  },
  globalNetworkText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  toast: {
    position: 'absolute',
    top: 64,
    left: spacing.md,
    right: spacing.md,
    zIndex: 60,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowColor: '#182120',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 8,
  },
  toastCopy: {
    flex: 1,
    gap: 2,
  },
  toastTitle: {
    color: colors.text,
    fontWeight: '900',
  },
  toastMessage: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  confirmBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(24, 33, 32, 0.34)',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dangerIcon: {
    backgroundColor: colors.surfaceDanger,
  },
  confirmTitle: {
    ...typography.sectionTitle,
  },
  confirmText: {
    ...typography.muted,
  },
  confirmActions: {
    gap: spacing.sm,
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
    backgroundColor: colors.surfaceNeutral,
  },
  statusPill_success: {
    backgroundColor: colors.surfaceSuccess,
  },
  statusPill_warning: {
    backgroundColor: colors.surfaceWarning,
  },
  statusPill_danger: {
    backgroundColor: colors.surfaceDanger,
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
