import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from '@/db/client';
import migrations from '@/drizzle/migrations';

/** Aplica las migraciones pendientes al abrir la app. */
export function useDatabaseReady() {
  return useMigrations(db, migrations);
}
