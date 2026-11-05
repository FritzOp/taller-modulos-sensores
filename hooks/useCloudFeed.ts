import { useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useAuth } from '@/context/AuthContext';
import { photosRepo } from '@/db/repositories/photos';
import { listCloudPage, type CloudPhoto } from '@/services/cloudPhotos';

export interface CloudFeedItem extends CloudPhoto {
  /** Copia en este teléfono: permite ver la imagen sin conexión y abrir el detalle. */
  localId: number | null;
  displayUri: string | null;
}

export function useCloudFeed(search: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const term = search.trim();

  const query = useInfiniteQuery({
    queryKey: ['cloud', userId, { search: term }], // cada búsqueda tiene su propia caché
    queryFn: ({ pageParam }) => listCloudPage({ userId: userId!, cursor: pageParam, search: term }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData, // al escribir se conserva la lista anterior, sin parpadeo
    enabled: !!userId,
  });

  const { data: localFiles = [] } = useLiveQuery(photosRepo.localFilesQuery(userId ?? ''), [userId]);

  const items = useMemo<CloudFeedItem[]>(() => {
    const local = new Map(localFiles.map((file) => [file.clientId, file]));
    return (query.data?.pages ?? [])
      .flatMap((page) => page.items)
      .map((item) => {
        const copy = local.get(item.client_id);
        return {
          ...item,
          localId: copy?.id ?? null,
          displayUri: copy?.uri ?? item.imageUrl,
        };
      });
  }, [query.data, localFiles]);

  return { ...query, items };
}
