// Mundo de pruebas: dos o más "teléfonos" con SQLite real y un servidor en memoria.
// Se ejecuta el código real de services/ y db/repositories; solo se reemplazan las fronteras:
// el cliente de Supabase, los archivos del teléfono y la conexión de db/client.
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';

export const USER = '11111111-1111-4111-8111-111111111111';
export const OTHER_USER = '22222222-2222-4222-8222-222222222222';

const DRIZZLE_DIR = path.join(__dirname, '..', '..', 'drizzle');

export function migrationStatements(upTo = Infinity): string[] {
  const journal = JSON.parse(fs.readFileSync(path.join(DRIZZLE_DIR, 'meta', '_journal.json'), 'utf8'));
  return journal.entries
    .filter((entry: { idx: number }) => entry.idx <= upTo)
    .flatMap((entry: { tag: string }) =>
      fs.readFileSync(path.join(DRIZZLE_DIR, `${entry.tag}.sql`), 'utf8').split('--> statement-breakpoint')
    );
}

// ---------- Servidor en memoria ----------

type Row = Record<string, any>;

/** Se cortó la red: igual que en el teléfono, la petición falla con un error. */
export class NetworkError extends Error {
  constructor() {
    super('Network request failed');
  }
}

class FakeCloud {
  rows: Row[] = [];
  files = new Map<string, ArrayBuffer>();
  online = true;
  requests = 0;
  /** La red se corta después de esta cantidad de peticiones. */
  cutAfter: number | null = null;
  /** Rutas que el bucket rechaza, para simular una foto que falla al subir. */
  rejectUploads = new Set<string>();
  /** Usuario de la sesión: el servidor aplica RLS con este valor, como auth.uid(). */
  sessionUser = USER;
  private serverClock = Date.UTC(2030, 0, 1);

  reset() {
    this.rows = [];
    this.files.clear();
    this.online = true;
    this.requests = 0;
    this.cutAfter = null;
    this.rejectUploads.clear();
    this.sessionUser = USER;
  }

  /** Cada petición pasa por aquí: es donde la red puede fallar. */
  hit() {
    if (!this.online) throw new NetworkError();
    if (this.cutAfter !== null && this.requests >= this.cutAfter) {
      this.online = false;
      throw new NetworkError();
    }
    this.requests++;
  }

  /** Mismo efecto que el trigger touch_server_updated_at, con microsegundos como PostgreSQL. */
  private nextServerTime() {
    this.serverClock += 1000;
    return new Date(this.serverClock).toISOString().replace('Z', '123+00:00');
  }

  upsert(row: Row): { error: Error | null } {
    if (row.user_id !== this.sessionUser) {
      return { error: new Error('new row violates row-level security policy') };
    }
    const existing = this.rows.find((candidate) => candidate.client_id === row.client_id);
    if (!existing) {
      this.rows.push({
        id: `srv-${this.rows.length}`,
        created_at: new Date(this.serverClock).toISOString(),
        ...row,
        server_updated_at: this.nextServerTime(),
      });
      return { error: null };
    }
    if (existing.user_id !== this.sessionUser) {
      return { error: new Error('new row violates row-level security policy') };
    }
    // Mismo efecto que el trigger reject_stale_photo_update
    if (new Date(row.updated_at).getTime() < new Date(existing.updated_at).getTime()) {
      return { error: null };
    }
    Object.assign(existing, row, { server_updated_at: this.nextServerTime() });
    return { error: null };
  }

  liveRows(userId = USER) {
    return this.rows.filter((row) => row.user_id === userId && !row.deleted_at);
  }

  row(clientId: string | null) {
    return this.rows.find((row) => row.client_id === clientId);
  }
}

export const cloud = new FakeCloud();

/** Constructor de consultas con solo lo que usa services/cloudPhotos.ts. */
type SelectAnswer = { data: Row[] | null; error: Error | null };

class FakeSelect implements PromiseLike<SelectAnswer> {
  private filters: ((row: Row) => boolean)[] = [(row) => row.user_id === cloud.sessionUser];
  private sorter: ((a: Row, b: Row) => number) | null = null;
  private max = Infinity;

  constructor(private readonly columns: string) {}

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  is(column: string, value: null) {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }
  gt(column: string, value: string) {
    this.filters.push((row) => new Date(row[column]).getTime() > new Date(value).getTime());
    return this;
  }
  lt(column: string, value: string) {
    this.filters.push((row) => new Date(row[column]).getTime() < new Date(value).getTime());
    return this;
  }
  ilike(column: string, pattern: string) {
    const text = pattern.slice(1, -1).replace(/\\([\\%_])/g, '$1').toLowerCase();
    this.filters.push((row) => String(row[column] ?? '').toLowerCase().includes(text));
    return this;
  }
  order(column: string, { ascending }: { ascending: boolean }) {
    const sign = ascending ? 1 : -1;
    this.sorter = (a, b) => sign * (new Date(a[column]).getTime() - new Date(b[column]).getTime());
    return this;
  }
  limit(max: number) {
    this.max = max;
    return this;
  }

  then<A = SelectAnswer, B = never>(
    onDone?: ((value: SelectAnswer) => A | PromiseLike<A>) | null,
    onFail?: ((reason: any) => B | PromiseLike<B>) | null
  ): Promise<A | B> {
    return new Promise<SelectAnswer>((resolve) => {
      cloud.hit();
      let rows = cloud.rows.filter((row) => this.filters.every((filter) => filter(row)));
      if (this.sorter) rows = [...rows].sort(this.sorter);
      rows = rows.slice(0, this.max);
      if (this.columns !== '*') {
        const names = this.columns.split(',').map((name) => name.trim());
        rows = rows.map((row) => Object.fromEntries(names.map((name) => [name, row[name]])));
      }
      resolve({ data: rows.map((row) => ({ ...row })), error: null });
    }).then(onDone, onFail);
  }
}

export const fakeSupabase = {
  from(_table: string) {
    return {
      select: (columns: string) => new FakeSelect(columns),
      upsert: async (row: Row, _options: { onConflict: string }) => {
        cloud.hit();
        return cloud.upsert(row);
      },
    };
  },
  storage: {
    from(_bucket: string) {
      return {
        upload: async (filePath: string, bytes: ArrayBuffer) => {
          cloud.hit();
          if (cloud.rejectUploads.has(filePath)) {
            return { data: null, error: new Error('Internal server error') };
          }
          if (cloud.files.has(filePath)) {
            return { data: null, error: new Error('The resource already exists') };
          }
          cloud.files.set(filePath, bytes);
          return { data: { path: filePath }, error: null };
        },
        remove: async (paths: string[]) => {
          cloud.hit();
          paths.forEach((filePath) => cloud.files.delete(filePath));
          return { data: [], error: null };
        },
        createSignedUrl: async (filePath: string) => {
          cloud.hit();
          if (!cloud.files.has(filePath)) {
            return { data: null, error: new Error('Object not found') };
          }
          return { data: { signedUrl: `signed://${filePath}` }, error: null };
        },
        createSignedUrls: async (paths: string[]) => {
          cloud.hit();
          return {
            data: paths.map((filePath) => ({
              path: filePath,
              signedUrl: cloud.files.has(filePath) ? `signed://${filePath}` : '',
              error: null,
            })),
            error: null,
          };
        },
      };
    },
  },
};

// ---------- Teléfonos ----------

export interface Phone {
  name: string;
  sqlite: Database.Database;
  db: BetterSQLite3Database<typeof schema>;
  files: Map<string, ArrayBuffer>;
}

let current: Phone | null = null;

export function createPhone(name: string, statements = migrationStatements()): Phone {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  statements.forEach((statement) => sqlite.exec(statement));
  const phone = { name, sqlite, db: drizzle(sqlite, { schema }), files: new Map() };
  current = phone;
  return phone;
}

/** Teléfono con la base en disco: se puede cerrar la app y volver a abrirla. */
export function createPhoneOnDisk(name: string, file: string): Phone {
  const phone = createPhone(name, []);
  phone.sqlite.close();
  phone.sqlite = new Database(file);
  migrationStatements().forEach((statement) => phone.sqlite.exec(statement));
  phone.db = drizzle(phone.sqlite, { schema });
  return phone;
}

/** Cierra la conexión y abre otra sobre el mismo archivo, sin volver a migrar. */
export function reopenPhone(phone: Phone, file: string) {
  phone.sqlite.close();
  phone.sqlite = new Database(file);
  phone.db = drizzle(phone.sqlite, { schema });
  current = phone;
}

/** Las siguientes llamadas al código real ocurren en este teléfono. */
export function usePhone(phone: Phone) {
  current = phone;
}

export function currentPhone(): Phone {
  if (!current) throw new Error('No hay un teléfono activo');
  return current;
}

/** Reemplaza a db/client: la conexión es la del teléfono activo. */
export const proxyDb = new Proxy(
  {},
  {
    get(_target, property) {
      const value = (currentPhone().db as any)[property];
      return typeof value === 'function' ? value.bind(currentPhone().db) : value;
    },
  }
);

/** Reemplaza a services/photoFiles: los archivos de cada teléfono viven en un Map. */
export const fakePhotoFiles = {
  persistPhoto(uri: string) {
    currentPhone().files.set(uri, new TextEncoder().encode(uri).buffer as ArrayBuffer);
    return uri;
  },
  async downloadPhotoFile(url: string, clientId: string) {
    cloud.hit();
    const bytes = cloud.files.get(url.replace('signed://', ''));
    if (!bytes) throw new Error('404');
    const uri = `file://${currentPhone().name}/${clientId}.jpg`;
    currentPhone().files.set(uri, bytes);
    return uri;
  },
  async readPhotoBytes(uri: string) {
    const bytes = currentPhone().files.get(uri);
    if (!bytes) throw new Error('El archivo local de la foto ya no existe');
    return bytes;
  },
  deletePhotoFile(uri: string) {
    currentPhone().files.delete(uri);
  },
};
