import { useCallback } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { albumsRepo } from '@/db/repositories/albums';
import { useAuth } from '@/context/AuthContext';

export function useAlbums() {
  const { userId } = useAuth();
  const { data: albums = [], error } = useLiveQuery(
    albumsRepo.listQuery(userId),
    [userId]
  );

  const createAlbum = useCallback(
    async (name: string) => {
      return albumsRepo.create(name, userId);
    },
    [userId]
  );

  const removeAlbum = useCallback(
    async (id: number) => {
      return albumsRepo.remove(id, userId);
    },
    [userId]
  );

  return {
    albums,
    createAlbum,
    removeAlbum,
    error,
  };
}
