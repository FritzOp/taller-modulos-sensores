import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { albums, syncQueue } from '@/db/schema';

export const albumsRepo = {
  listQuery(userId: string = 'local_guest') {
    return db
      .select()
      .from(albums)
      .where(eq(albums.userId, userId))
      .orderBy(asc(albums.name));
  },

  async findById(id: number, userId: string = 'local_guest') {
    return db
      .select()
      .from(albums)
      .where(and(eq(albums.id, id), eq(albums.userId, userId)))
      .get();
  },

  async create(name: string, userId: string = 'local_guest') {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('El nombre del álbum no puede estar vacío');
    return db
      .insert(albums)
      .values({
        name: trimmed,
        userId,
        syncStatus: 'pending',
      })
      .returning();
  },

  async updateSync(
    id: number,
    data: { remoteId?: string; syncStatus?: 'synced' | 'pending' | 'uploading' | 'error' }
  ) {
    return db.update(albums).set(data).where(eq(albums.id, id));
  },

  async remove(id: number, userId: string = 'local_guest') {
    const existing = await db
      .select()
      .from(albums)
      .where(and(eq(albums.id, id), eq(albums.userId, userId)))
      .get();

    if (existing?.remoteId) {
      // Coherent deletion: record pending remote deletion
      await db.insert(syncQueue).values({
        userId,
        entityType: 'album',
        remoteId: existing.remoteId,
      });
    }

    return db.delete(albums).where(and(eq(albums.id, id), eq(albums.userId, userId)));
  },
};
