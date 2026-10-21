import { useCallback } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo, type PhotoInput } from '@/db/repositories/photos';
import { persistPhoto } from '@/services/photoFiles';
import { useAuth } from '@/context/AuthContext';
import { syncManager } from '@/services/syncManager';
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
        syncStatus: 'pending',
      };

      // 2. Inserción local en SQLite
      await photosRepo.create(payload);

      // 3. Si el usuario está autenticado, intentar respaldo inmediato en segundo plano
      if (!isGuest) {
        syncManager.syncPendingUploads(userId).catch(() => {});
      }
    },
    [userId, isGuest]
  );

  const removePhoto = useCallback(
    async (id: number) => {
      await photosRepo.remove(id, userId);
      // Intentar procesar la eliminación remota en segundo plano
      if (!isGuest) {
        syncManager.syncPendingDeletions(userId).catch(() => {});
      }
    },
    [userId, isGuest]
  );

  const updatePhoto = useCallback(
    async (id: number, data: Partial<PhotoInput>) => {
      await photosRepo.update(id, data);
      if (!isGuest) {
        syncManager.syncPendingUploads(userId).catch(() => {});
      }
    },
    [userId, isGuest]
  );

  const clearAll = useCallback(async () => {
    await photosRepo.clearAll(userId);
    if (!isGuest) {
      syncManager.syncPendingDeletions(userId).catch(() => {});
    }
  }, [userId, isGuest]);

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
