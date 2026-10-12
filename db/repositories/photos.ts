import { and, desc, eq, isNotNull, like, SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { albums, photos, type NewPhoto } from '@/db/schema';
import { deletePhotoFile } from '@/services/photoFiles';

export type PhotoInput = Omit<NewPhoto, 'id' | 'createdAt'>;

export const photosRepo = {
  listQuery(search?: string, albumId?: number | null, onlyFavorites?: boolean) {
    const conditions: SQL[] = [];

    if (search && search.trim().length > 0) {
      conditions.push(like(photos.note, `%${search.trim()}%`));
    }

    if (albumId !== undefined && albumId !== null) {
      conditions.push(eq(photos.albumId, albumId));
    }

    if (onlyFavorites) {
      conditions.push(eq(photos.favorite, true));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return db
      .select({
        id: photos.id,
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
      })
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(whereClause)
      .orderBy(desc(photos.createdAt));
  },

  withLocationQuery() {
    return db
      .select({
        id: photos.id,
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
      })
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(and(isNotNull(photos.latitude), isNotNull(photos.longitude)))
      .orderBy(desc(photos.createdAt));
  },

  async findById(id: number) {
    return db
      .select({
        id: photos.id,
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
      })
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(eq(photos.id, id))
      .get();
  },

  async create(data: PhotoInput) {
    return db.insert(photos).values(data).returning();
  },

  async update(id: number, data: Partial<PhotoInput>) {
    return db.update(photos).set(data).where(eq(photos.id, id));
  },

  async remove(id: number) {
    const existing = await db.select().from(photos).where(eq(photos.id, id)).get();
    if (existing) {
      deletePhotoFile(existing.uri);
    }
    return db.delete(photos).where(eq(photos.id, id));
  },

  async clearAll() {
    const all = await db.select().from(photos).all();
    for (const item of all) {
      deletePhotoFile(item.uri);
    }
    return db.delete(photos);
  },
};
