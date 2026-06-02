import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { UserRole, ApplicationStatus } from '@stomvp/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/screen';
import { EmptyState, NetworkBanner, RetryState, StatusPill } from '../../components/ui';
import { api } from '../../src/api/client';
import { colors, radius, spacing, typography } from '../../src/constants/theme';
import { showError } from '../../src/store/feedback-store';
import { useAuthStore } from '../../src/store/auth-store';
import { callPhone } from '../../src/utils/linking-actions';
import { useResponsive } from '../../src/utils/responsive';

type ApplicationItem = {
  id: string;
  customerName: string;
  customerPhone: string;
  carModel?: string | null;
  issueDescription: string;
  status: ApplicationStatus;
  createdAt: string;
  workshop?: {
    title: string;
  } | null;
};

const statusLabels: Record<ApplicationStatus, string> = {
  [ApplicationStatus.NEW]: 'Новая',
  [ApplicationStatus.IN_PROGRESS]: 'В работе',
  [ApplicationStatus.COMPLETED]: 'Завершена',
  [ApplicationStatus.CANCELLED]: 'Отменена',
};

const statusTone: Record<ApplicationStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  [ApplicationStatus.NEW]: 'warning',
  [ApplicationStatus.IN_PROGRESS]: 'neutral',
  [ApplicationStatus.COMPLETED]: 'success',
  [ApplicationStatus.CANCELLED]: 'danger',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function RequestCardSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <View style={[styles.skeletonLine, { width: '64%' }]} />
      <View style={[styles.skeletonLine, { width: '46%' }]} />
      <View style={[styles.skeletonBlock, { height: 58 }]} />
    </View>
  );
}

export default function RequestsScreen() {
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.session?.user.role);
  const layout = useResponsive();
  const compact = layout.isSmallPhone;
  const isMaster = role === UserRole.MASTER;

  const requestsQuery = useQuery({
    queryKey: ['applications', role],
    queryFn: async () => {
      const { data } = await api.get<ApplicationItem[]>('/applications/mine', {
        params: {
          scope: isMaster ? 'received' : 'sent',
        },
      });
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (payload: { id: string; status: ApplicationStatus }) => {
      await api.patch(`/applications/${payload.id}/status`, { status: payload.status });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['applications', role] });
    },
  });
  const requestItems = requestsQuery.data ?? [];

  return (
    <Screen
      edges={['top', 'left', 'right']}
      refreshing={requestsQuery.isRefetching}
      onRefresh={() => void requestsQuery.refetch()}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="document-text" size={22} color="#FFFFFF" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { fontSize: layout.font(28, 0.25, 24, 30) }]}>
            {isMaster ? 'Заявки от клиентов' : 'Мои обращения'}
          </Text>
          <Text style={styles.subtitle}>
            {isMaster
              ? 'Следите за новыми обращениями и быстро переводите их в работу.'
              : 'Здесь сохраняются заявки, которые вы отправили мастерским.'}
          </Text>
        </View>
      </View>

      {requestsQuery.isError ? <NetworkBanner /> : null}

      {requestsQuery.isLoading && !requestItems.length ? (
        <>
          <RequestCardSkeleton />
          <RequestCardSkeleton />
          <RequestCardSkeleton />
        </>
      ) : requestsQuery.isError && !requestItems.length ? (
        <RetryState
          onRetry={() => void requestsQuery.refetch()}
          loading={requestsQuery.isRefetching}
        />
      ) : requestItems.length ? (
        <View style={[styles.stack, { gap: compact ? 10 : 14 }]}>
          {requestItems.map((item) => {
            const isUpdating = updateStatus.isPending && updateStatus.variables?.id === item.id;

            return (
              <View
                key={item.id}
                style={[
                  styles.card,
                  {
                    borderRadius: compact ? 18 : 22,
                    padding: compact ? 14 : 18,
                    gap: compact ? 8 : 10,
                  },
                ]}
              >
                <View style={styles.cardHead}>
                  <View style={styles.cardCopy}>
                    <Text style={[styles.cardTitle, { fontSize: layout.font(18, 0.2, 16, 19) }]}>
                      {item.workshop?.title ?? 'Мастерская'}
                    </Text>
                    <Text style={styles.muted}>
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>
                  <StatusPill label={statusLabels[item.status]} tone={statusTone[item.status]} />
                </View>

                <View style={styles.customerRow}>
                  <View style={styles.customerCopy}>
                    <Text style={styles.customerName}>{item.customerName}</Text>
                    <Text style={styles.muted}>{item.customerPhone}</Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      void callPhone(item.customerPhone).then((result) => {
                        if (!result.ok) {
                          showError(result.title, result.message);
                        }
                      })
                    }
                    style={({ pressed }) => [
                      styles.callButton,
                      pressed && styles.buttonPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Позвонить ${item.customerPhone}`}
                  >
                    <Ionicons name="call" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>

                {item.carModel ? <Text style={styles.metaLine}>Авто: {item.carModel}</Text> : null}
                <Text style={styles.description}>{item.issueDescription}</Text>

                {isMaster ? (
                  <View style={[styles.actions, compact && styles.actionsStack]}>
                    <Pressable
                      disabled={isUpdating || item.status === ApplicationStatus.IN_PROGRESS}
                      onPress={() =>
                        updateStatus.mutate({
                          id: item.id,
                          status: ApplicationStatus.IN_PROGRESS,
                        })
                      }
                      style={[
                        styles.actionButton,
                        compact && styles.actionButtonStacked,
                        (isUpdating || item.status === ApplicationStatus.IN_PROGRESS) &&
                          styles.disabledButton,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Перевести заявку в работу"
                    >
                      <Text style={styles.actionText}>В работу</Text>
                    </Pressable>
                    <Pressable
                      disabled={isUpdating || item.status === ApplicationStatus.COMPLETED}
                      onPress={() =>
                        updateStatus.mutate({
                          id: item.id,
                          status: ApplicationStatus.COMPLETED,
                        })
                      }
                      style={[
                        styles.actionButton,
                        compact && styles.actionButtonStacked,
                        (isUpdating || item.status === ApplicationStatus.COMPLETED) &&
                          styles.disabledButton,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Отметить заявку завершённой"
                    >
                      <Text style={styles.actionText}>Завершено</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyState
          icon="document-text-outline"
          title={isMaster ? 'Новых заявок пока нет' : 'Вы ещё не отправляли заявки'}
          text={
            isMaster
              ? 'Когда клиент оставит заявку в вашей карточке, она появится здесь.'
              : 'Откройте карточку мастерской и отправьте заявку на ремонт или консультацию.'
          }
          actionLabel={isMaster ? undefined : 'Найти мастера'}
          onAction={isMaster ? undefined : () => router.push('/(tabs)')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.muted,
  },
  stack: {
    gap: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardCopy: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontWeight: '800',
    color: colors.text,
    fontSize: 18,
  },
  muted: {
    color: colors.muted,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#F5FBF8',
    borderWidth: 1,
    borderColor: '#D7ECE5',
  },
  customerCopy: {
    flex: 1,
    gap: 3,
  },
  customerName: {
    color: colors.text,
    fontWeight: '800',
  },
  callButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  metaLine: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  description: {
    ...typography.body,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionsStack: {
    flexDirection: 'column',
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FFF0E5',
    borderWidth: 1,
    borderColor: '#F1D1BC',
  },
  actionButtonStacked: {
    alignItems: 'center',
  },
  actionText: {
    color: colors.accentDark,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  skeletonCard: {
    gap: 12,
    padding: 18,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skeletonLine: {
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: '#E5DFD5',
  },
  skeletonBlock: {
    borderRadius: radius.md,
    backgroundColor: '#E5DFD5',
  },
});
