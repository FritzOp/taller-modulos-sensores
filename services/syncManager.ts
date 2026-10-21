import * as Network from 'expo-network';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { photosRepo } from '@/db/repositories/photos';
import { downloadPhotoToPermanent } from '@/services/photoFiles';
import { db } from '@/db/client';
import { photos } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export interface SyncResult {
  success: boolean;
  uploadedCount: number;
  deletedCount: number;
  downloadedCount: number;
  errors: string[];
}

export const syncManager = {
  async isOnline(): Promise<boolean> {
    try {
      const state = await Network.getNetworkStateAsync();
      return Boolean(state.isConnected && state.isInternetReachable !== false);
    } catch {
      return true; // Fallback to attempting request
    }
  },

  /**
   * 1. Borrado Coherente: Procesa las eliminaciones pendientes hacia Supabase
   */
  async syncPendingDeletions(userId: string): Promise<number> {
    if (userId === 'local_guest' || !isSupabaseConfigured()) {
      return 0;
    }

    const online = await this.isOnline();
    if (!online) return 0;

    const deletions = await photosRepo.getPendingDeletions(userId);
    let deletedCount = 0;

    for (const item of deletions) {
      try {
        // Borrar archivo físico del bucket de Supabase Storage
        if (item.storagePath) {
          await supabase.storage.from('geocam-photos').remove([item.storagePath]);
        }

        // Borrar registro de la tabla en Supabase
        if (item.entityType === 'photo') {
          await supabase.from('geocam_photos').delete().eq('id', item.remoteId);

          // Registrar en la tabla de eliminados para otros dispositivos
          await supabase.from('geocam_deleted_records').insert({
            user_id: userId,
            entity_type: 'photo',
            entity_id: item.remoteId,
          });
        } else if (item.entityType === 'album') {
          await supabase.from('geocam_albums').delete().eq('id', item.remoteId);
        }

        // Limpiar la cola local
        await photosRepo.removeSyncQueueItem(item.id);
        deletedCount++;
      } catch (e) {
        console.warn('Error al sincronizar borrado:', e);
      }
    }

    return deletedCount;
  },

  /**
   * 2. Sincronización de Pendientes: Sube fotos locales pendientes a Supabase
   */
  async syncPendingUploads(userId: string): Promise<{ uploaded: number; errors: string[] }> {
    if (userId === 'local_guest' || !isSupabaseConfigured()) {
      return { uploaded: 0, errors: [] };
    }

    const online = await this.isOnline();
    if (!online) {
      return { uploaded: 0, errors: ['Sin conexión a internet'] };
    }

    const pendingPhotos = await photosRepo.getPendingSyncPhotos(userId);
    let uploaded = 0;
    const errors: string[] = [];

    for (const photo of pendingPhotos) {
      try {
        await photosRepo.updateSyncMetadata(photo.id, {
          syncStatus: 'uploading',
        });

        // 1. Cargar el archivo binario a Supabase Storage
        const fileResponse = await fetch(photo.uri);
        const fileBlob = await fileResponse.blob();

        const storageFileName = `${userId}/${photo.id}_${Date.now()}.jpg`;

        const { error: storageError } = await supabase.storage
          .from('geocam-photos')
          .upload(storageFileName, fileBlob, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (storageError) {
          throw new Error(`Storage upload error: ${storageError.message}`);
        }

        // 2. Obtener la URL pública del archivo
        const { data: publicData } = supabase.storage
          .from('geocam-photos')
          .getPublicUrl(storageFileName);

        const publicUrl = publicData.publicUrl;

        // 3. Upsert en la tabla geocam_photos de Supabase
        const remotePayload = {
          ...(photo.remoteId ? { id: photo.remoteId } : {}),
          user_id: userId,
          storage_path: storageFileName,
          public_url: publicUrl,
          latitude: photo.latitude,
          longitude: photo.longitude,
          accuracy: photo.accuracy,
          source: photo.source,
          note: photo.note,
          favorite: photo.favorite,
          client_created_at: new Date(photo.createdAt).toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: dbData, error: dbError } = await supabase
          .from('geocam_photos')
          .upsert(remotePayload)
          .select('id')
          .single();

        if (dbError) {
          throw new Error(`Database upsert error: ${dbError.message}`);
        }

        // 4. Actualizar metadata local en SQLite como sincronizada
        await photosRepo.updateSyncMetadata(photo.id, {
          remoteId: dbData.id,
          remoteUrl: publicUrl,
          syncStatus: 'synced',
          lastSyncedAt: new Date(),
        });

        uploaded++;
      } catch (err: any) {
        errors.push(`Foto ${photo.id}: ${err.message}`);
        await photosRepo.updateSyncMetadata(photo.id, {
          syncStatus: 'error',
        });
      }
    }

    return { uploaded, errors };
  },

  /**
   * 3. Consulta de la Nube: Descarga fotos y cambios respaldados en Supabase
   */
  async fetchCloudPhotos(userId: string): Promise<number> {
    if (userId === 'local_guest' || !isSupabaseConfigured()) {
      return 0;
    }

    const online = await this.isOnline();
    if (!online) return 0;

    // Obtener fotos remotas del usuario autenticado
    const { data: remotePhotos, error: fetchError } = await supabase
      .from('geocam_photos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (fetchError || !remotePhotos) {
      return 0;
    }

    // Obtener registros eliminados en la nube para borrado coherente
    const { data: deletedRemote } = await supabase
      .from('geocam_deleted_records')
      .select('entity_id')
      .eq('user_id', userId)
      .eq('entity_type', 'photo');

    if (deletedRemote && deletedRemote.length > 0) {
      const deletedIds = deletedRemote.map((d) => d.entity_id);
      for (const remoteId of deletedIds) {
        const local = await db
          .select()
          .from(photos)
          .where(and(eq(photos.remoteId, remoteId), eq(photos.userId, userId)))
          .get();
        if (local) {
          await photosRepo.remove(local.id, userId);
        }
      }
    }

    let downloadedCount = 0;

    for (const remote of remotePhotos) {
      const local = await db
        .select()
        .from(photos)
        .where(and(eq(photos.remoteId, remote.id), eq(photos.userId, userId)))
        .get();

      if (!local) {
        // La foto está en la nube pero no en el dispositivo: descargar archivo permanente
        const localUri = await downloadPhotoToPermanent(remote.public_url);

        await db.insert(photos).values({
          userId,
          uri: localUri,
          latitude: remote.latitude,
          longitude: remote.longitude,
          accuracy: remote.accuracy,
          source: remote.source as 'camera' | 'gallery',
          note: remote.note,
          favorite: remote.favorite ?? false,
          remoteId: remote.id,
          remoteUrl: remote.public_url,
          syncStatus: 'synced',
          lastSyncedAt: new Date(),
          createdAt: new Date(remote.client_created_at || remote.created_at),
        });

        downloadedCount++;
      } else {
        // La foto ya existe: actualizar notas y favoritos si cambiaron en la nube
        await db
          .update(photos)
          .set({
            note: remote.note,
            favorite: remote.favorite ?? false,
            remoteUrl: remote.public_url,
            syncStatus: 'synced',
            lastSyncedAt: new Date(),
          })
          .where(eq(photos.id, local.id));
      }
    }

    return downloadedCount;
  },

  /**
   * Ciclo Completo de Sincronización Confiable
   */
  async runFullSync(userId: string): Promise<SyncResult> {
    const online = await this.isOnline();
    if (!online) {
      return {
        success: false,
        uploadedCount: 0,
        deletedCount: 0,
        downloadedCount: 0,
        errors: ['Dispositivo offline. Los cambios se sincronizarán al recuperar conexión.'],
      };
    }

    try {
      // Paso 1: Procesar borrados pendientes (borrado coherente)
      const deletedCount = await this.syncPendingDeletions(userId);

      // Paso 2: Subir pendientes locales (sincronización de pendientes)
      const { uploaded, errors } = await this.syncPendingUploads(userId);

      // Paso 3: Consultar la nube y traer respaldos nuevos (consulta de la nube)
      const downloadedCount = await this.fetchCloudPhotos(userId);

      return {
        success: errors.length === 0,
        uploadedCount: uploaded,
        deletedCount,
        downloadedCount,
        errors,
      };
    } catch (err: any) {
      return {
        success: false,
        uploadedCount: 0,
        deletedCount: 0,
        downloadedCount: 0,
        errors: [err.message || 'Error general en sincronización'],
      };
    }
  },
};
