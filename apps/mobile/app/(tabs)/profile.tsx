import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PhotoStatus, UserRole, WorkshopDetails, WorkshopStatus } from '@stomvp/shared';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/screen';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/auth-store';
import { getWorkshopReadinessFromDetails } from '../../src/utils/workshop-readiness';

const statusLabels: Record<WorkshopStatus, string> = {
  [WorkshopStatus.DRAFT]: 'Черновик',
  [WorkshopStatus.PENDING]: 'На модерации',
  [WorkshopStatus.APPROVED]: 'Опубликовано',
  [WorkshopStatus.REJECTED]: 'Отклонено',
  [WorkshopStatus.BLOCKED]: 'Заблокировано',
};

const statusDescriptions: Record<WorkshopStatus, string> = {
  [WorkshopStatus.DRAFT]: 'Заполните карточку. Когда обязательные поля будут готовы, обычное сохранение само отправит объявление администратору.',
  [WorkshopStatus.PENDING]: 'Администратор проверяет объявление и загруженные материалы.',
  [WorkshopStatus.APPROVED]: 'Объявление опубликовано и видно клиентам в каталоге.',
  [WorkshopStatus.REJECTED]: 'Нужно исправить карточку по замечанию и отправить заново.',
  [WorkshopStatus.BLOCKED]: 'Объявление заблокировано. Нужна проверка администратора.',
};

function upsertWorkshop(workshops: WorkshopDetails[] | undefined, workshop: WorkshopDetails) {
  const current = workshops ?? [];
  return [workshop, ...current.filter((item) => item.id !== workshop.id)];
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const apiMessage = axios.isAxiosError(error) ? error.response?.data?.message : null;

  if (typeof apiMessage === 'string') {
    return apiMessage;
  }

  if (Array.isArray(apiMessage)) {
    return apiMessage.join('\n');
  }

  return fallback;
}

export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const setSession = useAuthStore((state) => state.setSession);

  const workshopsQuery = useQuery({
    queryKey: ['my-workshops'],
    enabled: session?.user.role === UserRole.MASTER,
    queryFn: async () => {
      const { data } = await api.get<WorkshopDetails[]>('/workshops/owner/mine');
      return data;
    },
  });

  const createDraftMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<WorkshopDetails>('/workshops/draft');
      return data;
    },
    onSuccess: async (workshop) => {
      queryClient.setQueryData<WorkshopDetails[]>(['my-workshops'], (current) =>
        upsertWorkshop(current, workshop),
      );
      await queryClient.invalidateQueries({ queryKey: ['my-workshops'] });
      router.push({
        pathname: '/master/workshop',
        params: { workshopId: workshop.id, returnToProfile: '1' },
      });
    },
    onError: (error) => {
      Alert.alert(
        'Не удалось создать объявление',
        getApiErrorMessage(error, 'Не получилось подготовить черновик. Попробуйте ещё раз.'),
      );
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/workshops/${id}`);
      return id;
    },
    onSuccess: async (deletedId) => {
      queryClient.setQueryData<WorkshopDetails[]>(['my-workshops'], (current) =>
        (current ?? []).filter((item) => item.id !== deletedId),
      );
      queryClient.removeQueries({ queryKey: ['workshop', deletedId] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-workshops'] }),
        queryClient.invalidateQueries({ queryKey: ['workshops'] }),
        queryClient.invalidateQueries({ queryKey: ['favorites'] }),
        queryClient.invalidateQueries({ queryKey: ['requests'] }),
      ]);
    },
    onError: (error) => {
      Alert.alert(
        'Не удалось удалить объявление',
        getApiErrorMessage(
          error,
          'Попробуйте ещё раз. Если проблема повторится, проверьте подключение к серверу.',
        ),
      );
    },
  });
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await api.delete('/users/me');
    },
    onSuccess: async () => {
      queryClient.clear();
      await setSession(null);
      router.replace('/(auth)/sign-in');
      Alert.alert(
        'Аккаунт удалён',
        'Ваш аккаунт и связанные с ним данные удалены с сервера.',
      );
    },
    onError: (error) => {
      Alert.alert(
        'Не удалось удалить аккаунт',
        getApiErrorMessage(
          error,
          'Попробуйте ещё раз. Если проблема повторится, проверьте подключение к серверу.',
        ),
      );
    },
  });
  const workshops = workshopsQuery.data ?? [];

  return (
    <Screen
      refreshing={workshopsQuery.isRefetching}
      onRefresh={
        session?.user.role === UserRole.MASTER ? () => void workshopsQuery.refetch() : undefined
      }
    >
      <View style={styles.card}>
        <Text style={styles.name}>{session?.user.fullName}</Text>
        <Text style={styles.muted}>
          {session?.user.phone} • {session?.user.role}
        </Text>
      </View>

      {session?.user.role === UserRole.MASTER ? (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Мои объявления</Text>
            <Text style={styles.muted}>
              Создавайте отдельные карточки под разные услуги, филиалы или мастерские.
            </Text>
            <Pressable
              onPress={() => createDraftMutation.mutate()}
              disabled={createDraftMutation.isPending}
              style={[styles.primaryButton, createDraftMutation.isPending && styles.disabledButton]}
            >
              <Text style={styles.primaryText}>
                {createDraftMutation.isPending
                  ? 'Создаём черновик...'
                  : 'Создать новое объявление'}
              </Text>
            </Pressable>
          </View>

          {workshops.length ? (
            workshops.map((workshop) => {
              const visiblePhotos = workshop.photos.filter(
                (photo) =>
                  photo.status === PhotoStatus.APPROVED || photo.status === PhotoStatus.PENDING,
              );
              const coverPhoto =
                visiblePhotos.find((photo) => photo.isPrimary) ?? visiblePhotos[0];
              const listingTitle = workshop.title.trim() || 'Черновик без названия';
              const listingAddress =
                workshop.city.trim() && workshop.addressLine.trim()
                  ? `${workshop.city}, ${workshop.addressLine}`
                  : 'Адрес пока не заполнен';
              const hasCoordinates = workshop.latitude != null && workshop.longitude != null;
              const isDeleting = deleteMutation.isPending && deleteMutation.variables === workshop.id;
              const pendingPhotos = workshop.photos.filter(
                (photo) => photo.status === PhotoStatus.PENDING,
              ).length;
              const approvedPhotos = workshop.photos.filter(
                (photo) => photo.status === PhotoStatus.APPROVED,
              ).length;
              const readiness = getWorkshopReadinessFromDetails(workshop);

              return (
                <View key={workshop.id} style={styles.listingCard}>
                  <View style={styles.listingHeader}>
                    <View style={styles.thumbWrap}>
                      {coverPhoto ? (
                        <Image source={{ uri: coverPhoto.url }} style={styles.thumbImage} />
                      ) : (
                        <View style={styles.thumbPlaceholder}>
                          <Ionicons name="image-outline" size={22} color={colors.accentDark} />
                        </View>
                      )}
                    </View>

                    <View style={styles.listingCopy}>
                      <Text style={styles.workshopTitle}>{listingTitle}</Text>
                      <Text style={styles.muted}>{listingAddress}</Text>

                      <View style={styles.badges}>
                        <View style={styles.statusPill}>
                          <Text style={styles.statusPillText}>{statusLabels[workshop.status]}</Text>
                        </View>
                        <View style={styles.metaPill}>
                          <Ionicons
                            name={hasCoordinates ? 'location' : 'location-outline'}
                            size={14}
                            color={hasCoordinates ? colors.success : colors.muted}
                          />
                          <Text style={styles.metaPillText}>
                            {hasCoordinates ? 'Точка на карте' : 'Без геометки'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.muted}>
                    {visiblePhotos.length} фото • {workshop.services.length} услуг •{' '}
                    {workshop.favoritesCount} в избранном
                  </Text>
                  <View style={styles.stageCard}>
                    <Text style={styles.stageLabel}>Текущая стадия</Text>
                    <Text style={styles.stageValue}>{statusLabels[workshop.status]}</Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${readiness.percent}%` }]} />
                    </View>
                    <Text style={styles.stageDescription}>
                      {statusDescriptions[workshop.status]}
                    </Text>
                    <Text style={styles.stageMeta}>
                      Фото: {approvedPhotos} одобрено • {pendingPhotos} на проверке
                    </Text>
                    {readiness.nextHints.length ? (
                      <Text style={styles.stageHint}>
                        Что ещё добавить: {readiness.nextHints.join(', ')}.
                      </Text>
                    ) : (
                      <Text style={styles.stageHint}>
                        Карточка заполнена хорошо. Следите за актуальностью фото и цен.
                      </Text>
                    )}
                  </View>

                  {workshop.rejectionReason ? (
                    <View style={styles.rejectionCard}>
                      <Text style={styles.rejectionTitle}>Причина отклонения</Text>
                      <Text style={styles.rejectionText}>{workshop.rejectionReason}</Text>
                    </View>
                  ) : null}

                  <View style={styles.actions}>
                    <Pressable
                      disabled={isDeleting}
                      onPress={() =>
                        router.push({
                          pathname: '/master/workshop',
                          params: { workshopId: workshop.id },
                        })
                      }
                      style={[styles.secondaryButton, isDeleting && styles.disabledButton]}
                    >
                      <Text style={styles.secondaryText}>Редактировать</Text>
                    </Pressable>
                  </View>

                  <Pressable
                    disabled={isDeleting}
                    onPress={() =>
                      Alert.alert(
                        'Удалить объявление?',
                        'Объявление, фото, услуги, отзывы, заявки и избранное для этой карточки будут удалены с сервера без возможности восстановления.',
                        [
                          { text: 'Отмена', style: 'cancel' },
                          {
                            text: 'Удалить',
                            style: 'destructive',
                            onPress: () => deleteMutation.mutate(workshop.id),
                          },
                        ],
                      )
                    }
                    style={[styles.dangerButton, isDeleting && styles.disabledButton]}
                  >
                    <Text style={styles.dangerText}>
                      {isDeleting ? 'Удаляем объявление...' : 'Удалить объявление'}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          ) : (
            <View style={styles.card}>
              <Text style={styles.workshopTitle}>Объявлений пока нет</Text>
              <Text style={styles.muted}>
                Создайте первую карточку, добавьте фото, услуги и точку на карте.
              </Text>
            </View>
          )}
        </>
      ) : null}

      <View style={[styles.card, styles.accountDangerCard]}>
        <Text style={styles.sectionTitle}>Удаление аккаунта</Text>
        <Text style={styles.muted}>
          Вы можете полностью удалить аккаунт. Профиль, объявления, фото, заявки,
          отзывы и избранное будут удалены с сервера без возможности восстановления.
        </Text>
        <Pressable
          disabled={deleteAccountMutation.isPending}
          onPress={() =>
            Alert.alert(
              'Удалить аккаунт навсегда?',
              'Это действие нельзя отменить. Все данные аккаунта будут удалены с сервера.',
              [
                { text: 'Отмена', style: 'cancel' },
                {
                  text: 'Удалить аккаунт',
                  style: 'destructive',
                  onPress: () => deleteAccountMutation.mutate(),
                },
              ],
            )
          }
          style={[
            styles.deleteAccountButton,
            deleteAccountMutation.isPending && styles.disabledButton,
          ]}
        >
          <Text style={styles.deleteAccountText}>
            {deleteAccountMutation.isPending ? 'Удаляем аккаунт...' : 'Удалить аккаунт'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={async () => {
          await setSession(null);
          router.replace('/(auth)/sign-in');
        }}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryText}>Выйти</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  muted: {
    color: colors.muted,
  },
  sectionTitle: {
    fontWeight: '700',
    color: colors.text,
    fontSize: 18,
  },
  listingCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  listingHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  thumbWrap: {
    width: 92,
    height: 92,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFF1E7',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingCopy: {
    flex: 1,
    gap: 6,
  },
  workshopTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFF0E5',
  },
  statusPillText: {
    color: colors.accentDark,
    fontWeight: '700',
    fontSize: 12,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F6F7F8',
  },
  metaPillText: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: colors.accent,
  },
  primaryText: {
    color: 'white',
    fontWeight: '700',
  },
  dangerButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: '#FFF4F0',
    borderWidth: 1,
    borderColor: '#E7B5A9',
  },
  dangerText: {
    color: '#C55B3C',
    fontWeight: '700',
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#FFF0E5',
    alignSelf: 'flex-start',
  },
  secondaryText: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
  rejectionCard: {
    gap: 6,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#FFF7DD',
    borderWidth: 1,
    borderColor: '#EEDDAB',
  },
  rejectionTitle: {
    fontWeight: '700',
    color: colors.text,
  },
  rejectionText: {
    color: colors.text,
    lineHeight: 20,
  },
  stageCard: {
    gap: 6,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F8F5EF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stageLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.muted,
    letterSpacing: 0.3,
  },
  stageValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  stageDescription: {
    color: colors.text,
    lineHeight: 20,
  },
  stageMeta: {
    color: colors.muted,
    fontWeight: '600',
  },
  stageHint: {
    color: colors.accentDark,
    lineHeight: 20,
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#ECE5DA',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  accountDangerCard: {
    borderColor: '#F1B3A7',
    backgroundColor: '#FFF9F6',
  },
  deleteAccountButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: '#D75A43',
  },
  deleteAccountText: {
    color: 'white',
    fontWeight: '800',
  },
});
