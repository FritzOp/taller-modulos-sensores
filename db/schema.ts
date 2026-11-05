import { sqliteTable, integer, real, text } from 'drizzle-orm/sqlite-core';

export const albums = sqliteTable('albums', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().default('local_guest'),
  name: text('name').notNull(),
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
  // Identidad compartida con la nube: el id autoincremental solo vale en este teléfono
  clientId: text('client_id').unique(),
  // Última modificación hecha por el usuario: decide los conflictos
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  // Ruta del archivo en el bucket
  remotePath: text('remote_path'),
  // Versión (updatedAt) que quedó en la nube. Pendiente = vacío o anterior a updatedAt
  syncedAt: integer('synced_at', { mode: 'timestamp_ms' }),
  // Borrado lógico: la foto se oculta y la marca viaja a los demás teléfonos
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
});

// Datos de la sincronización: cursor de bajada y último resultado de cada usuario
export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
