import { useCallback } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo, type PhotoChanges, type PhotoInput } from '@/db/repositories/photos';
import { persistPhoto } from '@/services/photoFiles';
import { useAuth } from '@/context/AuthContext';
import { requestSync } from '@/hooks/useSync';
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

/** El invitado no sincroniza: su foto solo existe en este teléfono. */
export function deleteWarning(isGuest: boolean, count = 1): string {
  const target = count === 1 ? 'esta foto' : `las ${count} fotos guardadas`;
  return isGuest
    ? `¿Deseas eliminar ${target}? No se puede deshacer.`
    : `¿Deseas eliminar ${target}? También se eliminará${count === 1 ? '' : 'n'} de la nube y de tus otros teléfonos.`;
}

export function usePhotos(filters?: PhotoFilterOptions) {
  const { userId, isGuest } = useAuth();
  const search = filters?.search;
  const albumId = filters?.albumId;
  const onlyFavorites = filters?.onlyFavorites;

  // Consultas reactivas segregadas por usuario
  const { data: photos = [], error } = useLiveQuery(
    photosRepo.listQuery(userId, search, albumId, onlyFavorites),
    [userId, search, albumId, onlyFavorites]
  );

  const { data: photosWithLocation = [] } = useLiveQuery(
    photosRepo.withLocationQuery(userId),
    [userId]
  );

  const addPhoto = useCallback(
    async (input: AddPhotoInput) => {
      // 1. Persistencia física en el sistema de archivos permanente
      const permanentUri = persistPhoto(input.uri);

      const payload: PhotoInput = {
        userId,
        uri: permanentUri,
        latitude: input.coords?.latitude ?? null,
        longitude: input.coords?.longitude ?? null,
        accuracy: input.coords?.accuracy ?? null,
        source: input.source,
        albumId: input.albumId ?? null,
        note: input.note ?? null,
        favorite: input.favorite ?? false,
      };

      // 2. Inserción local en SQLite
      await photosRepo.create(payload);

      // 3. Sin red, la petición queda en pausa y se reanuda sola al reconectar
      requestSync();
    },
    [userId]
  );

  const removePhoto = useCallback(
    async (id: number) => {
      await photosRepo.remove(id, userId);
      requestSync();
    },
    [userId]
  );

  const updatePhoto = useCallback(
    async (id: number, data: PhotoChanges) => {
      await photosRepo.update(id, data);
      requestSync();
    },
    []
  );

  const clearAll = useCallback(async () => {
    await photosRepo.clearAll(userId);
    requestSync();
  }, [userId]);

  return {
    deleteWarning: deleteWarning(isGuest),
    photos,
    photosWithLocation,
    addPhoto,
    removePhoto,
    updatePhoto,
    clearAll,
    error,
  };
}
