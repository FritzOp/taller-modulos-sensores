import { useCallback } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo, type PhotoInput } from '@/db/repositories/photos';
import { persistPhoto } from '@/services/photoFiles';
import type { Coords } from '@/types/geo';

export interface PhotoFilterOptions {
  search?: string;
  albumId?: number | null;
  onlyFavorites?: boolean;
}

export interface AddPhotoInput {
  uri: string;
  coords: Coords | null;
  source: 'camera' | 'gallery';
  albumId?: number | null;
  note?: string;
  favorite?: boolean;
}

export function usePhotos(filters?: PhotoFilterOptions) {
  const search = filters?.search;
  const albumId = filters?.albumId;
  const onlyFavorites = filters?.onlyFavorites;

  const { data: photos = [], error } = useLiveQuery(
    photosRepo.listQuery(search, albumId, onlyFavorites),
    [search, albumId, onlyFavorites]
  );

  const { data: photosWithLocation = [] } = useLiveQuery(
    photosRepo.withLocationQuery()
  );

  const addPhoto = useCallback(async (input: AddPhotoInput) => {
    // C5: Copy file from cache to permanent documents directory
    const permanentUri = persistPhoto(input.uri);

    const payload: PhotoInput = {
      uri: permanentUri,
      latitude: input.coords?.latitude ?? null,
      longitude: input.coords?.longitude ?? null,
      accuracy: input.coords?.accuracy ?? null,
      source: input.source,
      albumId: input.albumId ?? null,
      note: input.note ?? null,
      favorite: input.favorite ?? false,
    };

    await photosRepo.create(payload);
  }, []);

  const removePhoto = useCallback(async (id: number) => {
    await photosRepo.remove(id);
  }, []);

  const updatePhoto = useCallback(async (id: number, data: Partial<PhotoInput>) => {
    await photosRepo.update(id, data);
  }, []);

  const clearAll = useCallback(async () => {
    await photosRepo.clearAll();
  }, []);

  return {
    photos,
    photosWithLocation,
    addPhoto,
    removePhoto,
    updatePhoto,
    clearAll,
    error,
  };
}
