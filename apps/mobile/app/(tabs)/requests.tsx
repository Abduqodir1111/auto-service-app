import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRole, ApplicationStatus } from '@stomvp/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/auth-store';
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

export default function RequestsScreen() {
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.session?.user.role);
  const layout = useResponsive();
  const compact = layout.isSmallPhone;

  const requestsQuery = useQuery({
    queryKey: ['applications', role],
    queryFn: async () => {
      const { data } = await api.get<ApplicationItem[]>('/applications/mine', {
        params: {
          scope: role === UserRole.MASTER ? 'received' : 'sent',
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

  return (
    <Screen
      edges={['top', 'left', 'right']}
      refreshing={requestsQuery.isRefetching}
      onRefresh={() => void requestsQuery.refetch()}
    >
      <Text style={[styles.title, { fontSize: layout.font(28, 0.25, 24, 30) }]}>
        {role === UserRole.MASTER ? 'Заявки от клиентов' : 'Мои обращения'}
      </Text>

      <View style={[styles.stack, { gap: compact ? 10 : 14 }]}>
        {(requestsQuery.data ?? []).map((item) => (
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
            <Text style={[styles.cardTitle, { fontSize: layout.font(18, 0.2, 16, 19) }]}>
              {item.workshop?.title ?? 'Мастерская'}
            </Text>
            <Text style={styles.muted}>
              {item.customerName} • {item.customerPhone}
            </Text>
            <Text>{item.issueDescription}</Text>
            <Text style={styles.status}>{item.status}</Text>

            {role === UserRole.MASTER ? (
              <View style={[styles.actions, compact && styles.actionsStack]}>
                <Pressable
                  onPress={() =>
                    updateStatus.mutate({
                      id: item.id,
                      status: ApplicationStatus.IN_PROGRESS,
                    })
                  }
                  style={[styles.actionButton, compact && styles.actionButtonStacked]}
                >
                  <Text style={styles.actionText}>В работу</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    updateStatus.mutate({
                      id: item.id,
                      status: ApplicationStatus.COMPLETED,
                    })
                  }
                  style={[styles.actionButton, compact && styles.actionButtonStacked]}
                >
                  <Text style={styles.actionText}>Завершено</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
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
  cardTitle: {
    fontWeight: '700',
    fontSize: 18,
  },
  muted: {
    color: colors.muted,
  },
  status: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionsStack: {
    flexDirection: 'column',
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FFF0E5',
  },
  actionButtonStacked: {
    alignItems: 'center',
  },
  actionText: {
    color: colors.accentDark,
    fontWeight: '700',
  },
});
