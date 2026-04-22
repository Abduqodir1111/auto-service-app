import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRole, ApplicationStatus } from '@stomvp/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/auth-store';

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
    <Screen refreshing={requestsQuery.isRefetching} onRefresh={() => void requestsQuery.refetch()}>
      <Text style={styles.title}>
        {role === UserRole.MASTER ? 'Заявки от клиентов' : 'Мои обращения'}
      </Text>

      <View style={styles.stack}>
        {(requestsQuery.data ?? []).map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.workshop?.title ?? 'Мастерская'}</Text>
            <Text style={styles.muted}>
              {item.customerName} • {item.customerPhone}
            </Text>
            <Text>{item.issueDescription}</Text>
            <Text style={styles.status}>{item.status}</Text>

            {role === UserRole.MASTER ? (
              <View style={styles.actions}>
                <Pressable
                  onPress={() =>
                    updateStatus.mutate({
                      id: item.id,
                      status: ApplicationStatus.IN_PROGRESS,
                    })
                  }
                  style={styles.actionButton}
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
                  style={styles.actionButton}
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
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FFF0E5',
  },
  actionText: {
    color: colors.accentDark,
    fontWeight: '700',
  },
});
