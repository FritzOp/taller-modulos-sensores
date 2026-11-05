import { and, asc, desc, eq, gt, gte, isNotNull, isNull, like, lt, or, sql, type SQL } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { db } from '@/db/client';
import { albums, photos, type NewPhoto } from '@/db/schema';
import { deletePhotoFile } from '@/services/photoFiles';

export const LOCAL_GUEST = 'local_guest';

export type PhotoInput = Omit<NewPhoto, 'id' | 'createdAt' | 'clientId'>;
export type PhotoChanges = Partial<Pick<NewPhoto, 'note' | 'favorite' | 'albumId'>>;

const photoWithAlbum = {
  id: photos.id,
  userId: photos.userId,
  clientId: photos.clientId,
  uri: photos.uri,
  latitude: photos.latitude,
  longitude: photos.longitude,
  accuracy: photos.accuracy,
  source: photos.source,
  albumId: photos.albumId,
  albumName: albums.name,
  note: photos.note,
  favorite: photos.favorite,
  createdAt: photos.createdAt,
  updatedAt: photos.updatedAt,
  syncedAt: photos.syncedAt,
};

/**
 * Hora de un cambio hecho por el usuario. Siempre avanza respecto a la versión anterior,
 * aunque el reloj del teléfono esté atrasado: si no, la edición no quedaría pendiente.
 */
const nextVersion = () => sql`max(${Date.now()}, coalesce(${photos.updatedAt}, 0) + 1)`;

const isVisible = (userId: string) => and(eq(photos.userId, userId), isNull(photos.deletedAt));

export const photosRepo = {
  listQuery(
    userId: string = LOCAL_GUEST,
    search?: string,
    albumId?: number | null,
    onlyFavorites?: boolean
  ) {
    const conditions: (SQL | undefined)[] = [isVisible(userId)];

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
      .select(photoWithAlbum)
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(and(...conditions))
      .orderBy(desc(photos.createdAt));
  },

  withLocationQuery(userId: string = LOCAL_GUEST) {
    return db
      .select(photoWithAlbum)
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(and(isVisible(userId), isNotNull(photos.latitude), isNotNull(photos.longitude)))
      .orderBy(desc(photos.createdAt));
  },

  /** Una sola foto, reactiva: la pantalla de detalle se entera si la sincronización la cambia. */
  byIdQuery(id: number, userId: string) {
    return db
      .select(photoWithAlbum)
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(and(eq(photos.id, id), isVisible(userId)))
      .limit(1);
  },

  /** Copias locales de las fotos, para que el feed de la nube muestre imágenes sin conexión. */
  localFilesQuery(userId: string) {
    return db
      .select({ id: photos.id, clientId: photos.clientId, uri: photos.uri })
      .from(photos)
      .where(isVisible(userId));
  },

  async create(data: PhotoInput) {
    return db
      .insert(photos)
      .values({ ...data, clientId: Crypto.randomUUID() })
      .returning();
  },

  /** Edición hecha por el usuario: la foto queda pendiente de subir. */
  async update(id: number, changes: PhotoChanges) {
    return db
      .update(photos)
      .set({ ...changes, updatedAt: nextVersion() })
      .where(eq(photos.id, id));
  },

  /**
   * Borrar es marcar: la foto se oculta y la marca viaja a la nube. El archivo se elimina
   * cuando la marca ya está sincronizada. El invitado nunca sincroniza, así que borra de una vez.
   */
  async remove(id: number, userId: string = LOCAL_GUEST) {
    const where = and(eq(photos.id, id), eq(photos.userId, userId));

    if (userId === LOCAL_GUEST) {
      const existing = await db.select({ uri: photos.uri }).from(photos).where(where).get();
      await db.delete(photos).where(where);
      if (existing) deletePhotoFile(existing.uri);
      return;
    }

    await db
      .update(photos)
      .set({ deletedAt: new Date(), updatedAt: nextVersion() })
      .where(where);
  },

  async clearAll(userId: string = LOCAL_GUEST) {
    if (userId === LOCAL_GUEST) {
      const all = await db
        .select({ uri: photos.uri })
        .from(photos)
        .where(eq(photos.userId, userId))
        .all();
      await db.delete(photos).where(eq(photos.userId, userId));
      all.forEach((item) => deletePhotoFile(item.uri));
      return;
    }

    await db
      .update(photos)
      .set({ deletedAt: new Date(), updatedAt: nextVersion() })
      .where(isVisible(userId));
  },

  // ---------- Soporte para la sincronización ----------

  /** Pendiente = nunca sincronizada, o cambiada después de la última subida (incluye borrados). */
  pendingQuery(userId: string) {
    return db
      .select()
      .from(photos)
      .where(
        and(eq(photos.userId, userId), or(isNull(photos.syncedAt), gt(photos.updatedAt, photos.syncedAt)))
      )
      .orderBy(asc(photos.createdAt));
  },

  async listPending(userId: string) {
    return photosRepo.pendingQuery(userId).all();
  },

  async findByClientId(clientId: string, userId: string) {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.clientId, clientId), eq(photos.userId, userId)))
      .get();
  },

  /** Foto que llegó de la nube: nace sincronizada. */
  async insertFromRemote(data: NewPhoto) {
    await db.insert(photos).values(data).onConflictDoNothing();
  },

  /**
   * Aplica en local una versión más nueva de la nube. Nunca usa la hora actual, y la condición
   * sobre updatedAt protege una edición que el usuario haya hecho durante la descarga.
   */
  async applyRemote(
    id: number,
    changes: {
      note: string | null;
      favorite: boolean;
      remotePath: string | null;
      deletedAt: Date | null;
      updatedAt: Date;
      syncedAt: Date;
    }
  ) {
    await db
      .update(photos)
      .set(changes)
      .where(
        and(eq(photos.id, id), or(isNull(photos.updatedAt), lt(photos.updatedAt, changes.updatedAt)))
      );
  },

  /**
   * Un cambio local le ganó a un borrado remoto: la foto revive, pero su archivo ya pudo salir
   * del bucket. Sin remotePath, la subida vuelve a enviar el archivo.
   */
  async markForReupload(id: number) {
    await db.update(photos).set({ remotePath: null, syncedAt: null }).where(eq(photos.id, id));
  },

  /** syncedAt es la versión que se subió, no "ahora": una edición durante la subida sigue pendiente. */
  async markSynced(id: number, remotePath: string, syncedAt: Date) {
    await db.update(photos).set({ remotePath, syncedAt }).where(eq(photos.id, id));
  },

  /** Marcas de borrado que ya llegaron a la nube: sus archivos ya se pueden eliminar. */
  async listPurgeable(userId: string) {
    return db
      .select()
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          isNotNull(photos.deletedAt),
          isNotNull(photos.syncedAt),
          gte(photos.syncedAt, photos.updatedAt)
        )
      )
      .all();
  },

  async deleteRow(id: number) {
    await db.delete(photos).where(eq(photos.id, id));
  },
};
