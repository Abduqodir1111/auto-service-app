import { QueryClient, QueryKey } from '@tanstack/react-query';
import { WorkshopDetails, WorkshopSummary } from '@stomvp/shared';

type FavoriteWorkshop = {
  id: string;
  favoritesCount: number;
  isFavorite?: boolean;
};

function patchWorkshopFavoriteState<T extends FavoriteWorkshop>(workshop: T, isFavorite: boolean): T {
  const nextFavoritesCount = Math.max(0, workshop.favoritesCount + (isFavorite ? 1 : -1));

  return {
    ...workshop,
    isFavorite,
    favoritesCount: nextFavoritesCount,
  };
}

function updateWorkshopLists(
  queryClient: QueryClient,
  nextState: boolean,
  workshop: FavoriteWorkshop,
) {
  const workshopQueries = queryClient.getQueriesData<WorkshopSummary[]>({ queryKey: ['workshops'] });

  workshopQueries.forEach(([queryKey, current]) => {
    if (!current) {
      return;
    }

    const nextItems = current
      .map((item) =>
        item.id === workshop.id ? patchWorkshopFavoriteState(item, nextState) : item,
      );

    queryClient.setQueryData(queryKey as QueryKey, nextItems);
  });
}

export function syncFavoriteCaches(
  queryClient: QueryClient,
  workshop: FavoriteWorkshop,
  nextState: boolean,
) {
  const snapshot = {
    details: queryClient.getQueryData<WorkshopDetails>(['workshop', workshop.id]),
    favorites: queryClient.getQueryData<WorkshopSummary[]>(['favorites']),
    workshopQueries: queryClient.getQueriesData<WorkshopSummary[]>({ queryKey: ['workshops'] }),
  };

  const nextWorkshop = patchWorkshopFavoriteState(workshop, nextState) as WorkshopSummary;

  queryClient.setQueryData<WorkshopDetails | undefined>(['workshop', workshop.id], (current) => {
    if (!current) {
      return current;
    }

    return patchWorkshopFavoriteState(current, nextState);
  });

  queryClient.setQueryData<WorkshopSummary[]>(['favorites'], (current) => {
    const list = current ?? [];
    const existingIndex = list.findIndex((item) => item.id === workshop.id);

    if (nextState) {
      if (existingIndex >= 0) {
        return list.map((item) =>
          item.id === workshop.id ? patchWorkshopFavoriteState(item, true) : item,
        );
      }

      return [nextWorkshop, ...list];
    }

    if (existingIndex < 0) {
      return list;
    }

    return list.filter((item) => item.id !== workshop.id);
  });

  updateWorkshopLists(queryClient, nextState, workshop);

  return () => {
    queryClient.setQueryData(['workshop', workshop.id], snapshot.details);
    queryClient.setQueryData(['favorites'], snapshot.favorites);

    snapshot.workshopQueries.forEach(([queryKey, data]) => {
      queryClient.setQueryData(queryKey, data);
    });
  };
}
