import { sqliteTable, integer, real, text } from 'drizzle-orm/sqlite-core';

export const albums = sqliteTable('albums', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().default('local_guest'),
  name: text('name').notNull(),
  remoteId: text('remote_id'),
  syncStatus: text('sync_status', {
    enum: ['synced', 'pending', 'uploading', 'error'],
  })
    .notNull()
    .default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const photos = sqliteTable('photos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().default('local_guest'),
  uri: text('uri').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  accuracy: real('accuracy'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  source: text('source', { enum: ['camera', 'gallery'] }).notNull(),
  albumId: integer('album_id').references(() => albums.id, {
    onDelete: 'set null',
  }),
  note: text('note'),
  favorite: integer('favorite', { mode: 'boolean' })
    .notNull()
    .default(false),
  remoteId: text('remote_id'),
  remoteUrl: text('remote_url'),
  syncStatus: text('sync_status', {
    enum: ['synced', 'pending', 'uploading', 'error'],
  })
    .notNull()
    .default('pending'),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp_ms' }),
});

export const syncQueue = sqliteTable('sync_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  entityType: text('entity_type', { enum: ['photo', 'album'] }).notNull(),
  remoteId: text('remote_id').notNull(),
  storagePath: text('storage_path'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;

export type SyncQueueItem = typeof syncQueue.$inferSelect;
export type NewSyncQueueItem = typeof syncQueue.$inferInsert;
