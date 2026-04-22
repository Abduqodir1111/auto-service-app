import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Text, View } from 'react-native';
import { WorkshopSummary } from '@stomvp/shared';
import { Screen } from '../../components/screen';
import { WorkshopCard } from '../../components/workshop-card';
import { api } from '../../src/api/client';
import { syncFavoriteCaches } from '../../src/utils/favorites-cache';

export default function FavoritesScreen() {
  const queryClient = useQueryClient();
  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const { data } = await api.get<WorkshopSummary[]>('/favorites');
      return data;
    },
  });
  const removeFavoriteMutation = useMutation({
    mutationFn: async (workshop: WorkshopSummary) => {
      await api.delete(`/favorites/${workshop.id}`);
    },
    onMutate: async (workshop) => {
      const rollback = syncFavoriteCaches(queryClient, workshop, false);
      return { rollback };
    },
    onError: (_error, _workshop, context) => {
      context?.rollback?.();
      Alert.alert('Не удалось удалить из избранного', 'Попробуйте ещё раз.');
    },
    onSuccess: async (_data, workshop) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['favorites'] }),
        queryClient.invalidateQueries({ queryKey: ['workshop', workshop.id] }),
        queryClient.invalidateQueries({ queryKey: ['workshops'] }),
      ]);
    },
  });

  return (
    <Screen refreshing={favoritesQuery.isRefetching} onRefresh={() => void favoritesQuery.refetch()}>
      <Text style={{ fontSize: 28, fontWeight: '800' }}>Избранное</Text>
      {(favoritesQuery.data ?? []).length ? (
        <View style={{ gap: 14 }}>
          {(favoritesQuery.data ?? []).map((workshop) => (
            <WorkshopCard
              key={workshop.id}
              workshop={workshop}
              favoriteAction={{
                label: 'Убрать',
                isDanger: true,
                disabled: removeFavoriteMutation.isPending,
                onPress: () => removeFavoriteMutation.mutate(workshop),
              }}
            />
          ))}
        </View>
      ) : (
        <Text style={{ marginTop: 12, color: '#6F7E79', lineHeight: 20 }}>
          Здесь пока пусто. Добавьте СТО в избранное из карточки, и оно появится здесь.
        </Text>
      )}
    </Screen>
  );
}
