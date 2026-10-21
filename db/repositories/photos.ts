import { and, desc, eq, inArray, isNotNull, like, SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { albums, photos, syncQueue, type NewPhoto } from '@/db/schema';
import { deletePhotoFile } from '@/services/photoFiles';

export type PhotoInput = Omit<NewPhoto, 'id' | 'createdAt'>;

export const photosRepo = {
  listQuery(
    userId: string = 'local_guest',
    search?: string,
    albumId?: number | null,
    onlyFavorites?: boolean
  ) {
    const conditions: SQL[] = [eq(photos.userId, userId)];

    if (search && search.trim().length > 0) {
      conditions.push(like(photos.note, `%${search.trim()}%`));
    }

    if (albumId !== undefined && albumId !== null) {
      conditions.push(eq(photos.albumId, albumId));
    }

    if (onlyFavorites) {
      conditions.push(eq(photos.favorite, true));
    }

    return db
      .select({
        id: photos.id,
        userId: photos.userId,
        uri: photos.uri,
        latitude: photos.latitude,
        longitude: photos.longitude,
        accuracy: photos.accuracy,
        source: photos.source,
        albumId: photos.albumId,
        albumName: albums.name,
        note: photos.note,
        favorite: photos.favorite,
        remoteId: photos.remoteId,
        remoteUrl: photos.remoteUrl,
        syncStatus: photos.syncStatus,
        lastSyncedAt: photos.lastSyncedAt,
        createdAt: photos.createdAt,
      })
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(and(...conditions))
      .orderBy(desc(photos.createdAt));
  },

  withLocationQuery(userId: string = 'local_guest') {
    return db
      .select({
        id: photos.id,
        userId: photos.userId,
        uri: photos.uri,
        latitude: photos.latitude,
        longitude: photos.longitude,
        accuracy: photos.accuracy,
        source: photos.source,
        albumId: photos.albumId,
        albumName: albums.name,
        note: photos.note,
        favorite: photos.favorite,
        remoteId: photos.remoteId,
        remoteUrl: photos.remoteUrl,
        syncStatus: photos.syncStatus,
        lastSyncedAt: photos.lastSyncedAt,
        createdAt: photos.createdAt,
      })
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(
        and(
          eq(photos.userId, userId),
          isNotNull(photos.latitude),
          isNotNull(photos.longitude)
        )
      )
      .orderBy(desc(photos.createdAt));
  },

  async findById(id: number, userId?: string) {
    const conditions = [eq(photos.id, id)];
    if (userId) {
      conditions.push(eq(photos.userId, userId));
    }

    return db
      .select({
        id: photos.id,
        userId: photos.userId,
        uri: photos.uri,
        latitude: photos.latitude,
        longitude: photos.longitude,
        accuracy: photos.accuracy,
        source: photos.source,
        albumId: photos.albumId,
        albumName: albums.name,
        note: photos.note,
        favorite: photos.favorite,
        remoteId: photos.remoteId,
        remoteUrl: photos.remoteUrl,
        syncStatus: photos.syncStatus,
        lastSyncedAt: photos.lastSyncedAt,
        createdAt: photos.createdAt,
      })
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(and(...conditions))
      .get();
  },

  async getPendingSyncPhotos(userId: string) {
    return db
      .select()
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          inArray(photos.syncStatus, ['pending', 'error'])
        )
      )
      .all();
  },

  async getPendingDeletions(userId: string) {
    return db
      .select()
      .from(syncQueue)
      .where(eq(syncQueue.userId, userId))
      .all();
  },

  async removeSyncQueueItem(id: number) {
    return db.delete(syncQueue).where(eq(syncQueue.id, id));
  },

  async create(data: PhotoInput) {
    return db.insert(photos).values(data).returning();
  },

  async update(id: number, data: Partial<PhotoInput>) {
    // Whenever content changes, mark as pending sync
    const patch = {
      ...data,
      syncStatus: 'pending' as const,
    };
    return db.update(photos).set(patch).where(eq(photos.id, id));
  },

  async updateSyncMetadata(
    id: number,
    data: {
      remoteId?: string;
      remoteUrl?: string;
      syncStatus: 'synced' | 'pending' | 'uploading' | 'error';
      lastSyncedAt?: Date;
    }
  ) {
    return db.update(photos).set(data).where(eq(photos.id, id));
  },

  async remove(id: number, userId: string = 'local_guest') {
    const existing = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, id), eq(photos.userId, userId)))
      .get();

    if (existing) {
      // Coherent deletion: if it was synced to cloud, register in syncQueue
      if (existing.remoteId) {
        let storagePath = null;
        if (existing.remoteUrl) {
          // Extract storage path from public URL if possible
          const parts = existing.remoteUrl.split('geocam-photos/');
          if (parts.length > 1) {
            storagePath = decodeURIComponent(parts[1]);
          }
        }

        await db.insert(syncQueue).values({
          userId,
          entityType: 'photo',
          remoteId: existing.remoteId,
          storagePath,
        });
      }

      deletePhotoFile(existing.uri);
    }

    return db.delete(photos).where(and(eq(photos.id, id), eq(photos.userId, userId)));
  },

  async clearAll(userId: string = 'local_guest') {
    const all = await db
      .select()
      .from(photos)
      .where(eq(photos.userId, userId))
      .all();

    for (const item of all) {
      if (item.remoteId) {
        let storagePath = null;
        if (item.remoteUrl) {
          const parts = item.remoteUrl.split('geocam-photos/');
          if (parts.length > 1) {
            storagePath = decodeURIComponent(parts[1]);
          }
        }
        await db.insert(syncQueue).values({
          userId,
          entityType: 'photo',
          remoteId: item.remoteId,
          storagePath,
        });
      }
      deletePhotoFile(item.uri);
    }

    return db.delete(photos).where(eq(photos.userId, userId));
  },
};
