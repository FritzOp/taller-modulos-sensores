import { useCallback } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useAuth } from '@/context/AuthContext';
import { photosRepo, type PhotoChanges } from '@/db/repositories/photos';
import { requestSync } from '@/hooks/useSync';

/** Una foto, reactiva: si la sincronización la edita o la borra, la pantalla se entera. */
export function usePhoto(id: number) {
  const { userId } = useAuth();
  const { data, updatedAt } = useLiveQuery(photosRepo.byIdQuery(id, userId), [id, userId]);

  const update = useCallback(
    async (changes: PhotoChanges) => {
      await photosRepo.update(id, changes);
      requestSync();
    },
    [id]
  );

  const remove = useCallback(async () => {
    await photosRepo.remove(id, userId);
    requestSync();
  }, [id, userId]);

  return {
    photo: data?.[0] ?? null,
    isLoading: updatedAt === undefined,
    update,
    remove,
  };
}
