import { useCallback } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { albumsRepo } from '@/db/repositories/albums';

export function useAlbums() {
  const { data: albums = [], error } = useLiveQuery(albumsRepo.listQuery());

  const createAlbum = useCallback(async (name: string) => {
    return albumsRepo.create(name);
  }, []);

  const removeAlbum = useCallback(async (id: number) => {
    return albumsRepo.remove(id);
  }, []);

  return {
    albums,
    createAlbum,
    removeAlbum,
    error,
  };
}
