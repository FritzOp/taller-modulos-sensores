import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { syncMeta } from '@/db/schema';

/** Pares clave-valor de la sincronización (cursor de bajada, último resultado). */
export const syncMetaRepo = {
  byKeyQuery(key: string) {
    return db.select().from(syncMeta).where(eq(syncMeta.key, key)).limit(1);
  },

  async get(key: string): Promise<string | null> {
    const row = await db.select().from(syncMeta).where(eq(syncMeta.key, key)).get();
    return row?.value ?? null;
  },

  async set(key: string, value: string) {
    await db
      .insert(syncMeta)
      .values({ key, value })
      .onConflictDoUpdate({ target: syncMeta.key, set: { value } });
  },
};
