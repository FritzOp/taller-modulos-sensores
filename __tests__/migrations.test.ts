// Las migraciones reales de drizzle/ sobre una base con datos de la versión anterior.
import { createPhone, migrationStatements } from './helpers/world';

jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

const LEGACY_LAST_MIGRATION = 2;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REMOTE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const QUEUED_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function legacyPhone() {
  const phone = createPhone('legado', migrationStatements(LEGACY_LAST_MIGRATION));
  const insert = phone.sqlite.prepare(`
    INSERT INTO photos (user_id, uri, source, created_at, note, remote_id, remote_url, sync_status, last_synced_at)
    VALUES (@user, @uri, 'camera', 1000, @note, @remoteId, @remoteUrl, @status, @syncedAt)
  `);
  insert.run({ user: 'u1', uri: 'file://1.jpg', note: 'respaldada', remoteId: REMOTE_ID, remoteUrl: 'https://x/geocam-photos/u1/1.jpg', status: 'synced', syncedAt: 5000 });
  insert.run({ user: 'u1', uri: 'file://2.jpg', note: 'pendiente', remoteId: null, remoteUrl: null, status: 'pending', syncedAt: null });
  insert.run({ user: 'local_guest', uri: 'file://3.jpg', note: 'invitado', remoteId: null, remoteUrl: null, status: 'pending', syncedAt: null });
  phone.sqlite
    .prepare(`INSERT INTO sync_queue (user_id, entity_type, remote_id, storage_path, created_at) VALUES ('u1', 'photo', ?, 'u1/viejo.jpg', 2000)`)
    .run(QUEUED_ID);
  return phone;
}

function upgrade(phone: ReturnType<typeof createPhone>) {
  migrationStatements()
    .slice(migrationStatements(LEGACY_LAST_MIGRATION).length)
    .forEach((statement) => phone.sqlite.exec(statement));
}

const rows = (phone: ReturnType<typeof createPhone>) =>
  phone.sqlite.prepare('SELECT * FROM photos ORDER BY id').all() as any[];

describe('Migración 0003 y 0004 con datos existentes', () => {
  test('no se pierde ninguna foto y cada una recibe identidad compartida', () => {
    const phone = legacyPhone();
    upgrade(phone);
    const [backedUp, pending, guest] = rows(phone);

    expect(rows(phone).map((row) => row.note).slice(0, 3)).toEqual(['respaldada', 'pendiente', 'invitado']);
    expect(backedUp.client_id).toBe(REMOTE_ID); // conserva el id de la nube
    expect(pending.client_id).toMatch(UUID);
    expect(guest.client_id).toMatch(UUID);
    expect(pending.client_id).not.toBe(guest.client_id);
    phone.sqlite.close();
  });

  test('todas quedan pendientes y las respaldadas conservan su fecha como versión', () => {
    const phone = legacyPhone();
    upgrade(phone);
    const [backedUp, pending] = rows(phone);

    expect(backedUp.updated_at).toBe(5000);
    expect(pending.updated_at).toBeGreaterThan(5000); // sus ediciones sin subir son lo más nuevo
    expect(rows(phone).every((row) => row.synced_at === null)).toBe(true);
    phone.sqlite.close();
  });

  test('los borrados de la cola antigua pasan a ser marcas pendientes de subir', () => {
    const phone = legacyPhone();
    upgrade(phone);
    const tombstone = rows(phone).find((row) => row.client_id === QUEUED_ID);

    expect(tombstone.deleted_at).not.toBeNull();
    expect(tombstone.remote_path).toBe('u1/viejo.jpg');
    expect(tombstone.user_id).toBe('u1');
    phone.sqlite.close();
  });

  test('las columnas y la tabla antiguas ya no existen', () => {
    const phone = legacyPhone();
    upgrade(phone);
    const columns = (table: string) =>
      (phone.sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

    expect(columns('photos')).toEqual(expect.arrayContaining(['client_id', 'updated_at', 'remote_path', 'synced_at', 'deleted_at']));
    expect(columns('photos')).not.toEqual(expect.arrayContaining(['sync_status']));
    expect(columns('photos')).not.toContain('remote_id');
    expect(columns('albums')).not.toContain('sync_status');
    expect(columns('sync_queue')).toEqual([]);
    expect(columns('sync_meta')).toEqual(['key', 'value']);
    phone.sqlite.close();
  });

  test('client_id no admite duplicados', () => {
    const phone = createPhone('nuevo');
    const insert = phone.sqlite.prepare(`INSERT INTO photos (uri, source, created_at, client_id) VALUES ('u', 'camera', 1, 'igual')`);
    insert.run();
    expect(() => insert.run()).toThrow(/UNIQUE/);
    phone.sqlite.close();
  });
});
