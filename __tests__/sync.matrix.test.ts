// Matriz de pruebas C6 y casos borde: código real de services/sync.ts y de los repositorios,
// con SQLite real y las migraciones reales, contra un servidor en memoria.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { photosRepo } from '@/db/repositories/photos';
import { syncMetaRepo } from '@/db/repositories/syncMeta';
import { lastResultKey, syncAll, SyncFailuresError } from '@/services/sync';
import {
  cloud,
  createPhone,
  createPhoneOnDisk,
  currentPhone,
  fakePhotoFiles,
  OTHER_USER,
  reopenPhone,
  usePhone,
  USER,
  type Phone,
} from './helpers/world';

jest.mock('@/db/client', () => ({ db: require('./helpers/world').proxyDb }));
jest.mock('@/services/supabase', () => ({ supabase: require('./helpers/world').fakeSupabase }));
jest.mock('@/services/photoFiles', () => require('./helpers/world').fakePhotoFiles);
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

let photoCounter = 0;
let A: Phone;
let B: Phone;

/** El reloj del teléfono avanza: cada acción ocurre después de la anterior. */
function advance(ms = 60_000) {
  jest.setSystemTime(Date.now() + ms);
}

async function takePhoto(phone: Phone, note: string | null = null, userId = USER) {
  usePhone(phone);
  const uri = fakePhotoFiles.persistPhoto(`file://${phone.name}/foto-${++photoCounter}.jpg`);
  const [row] = await photosRepo.create({
    userId,
    uri,
    latitude: 11.5444,
    longitude: -72.9072,
    accuracy: 5,
    source: 'camera',
    note,
  });
  advance();
  return row;
}

async function sync(phone: Phone, userId = USER) {
  usePhone(phone);
  cloud.sessionUser = userId;
  return syncAll(userId);
}

function visible(phone: Phone, userId = USER) {
  usePhone(phone);
  return photosRepo.listQuery(userId).all();
}

function pendingCount(phone: Phone, userId = USER) {
  usePhone(phone);
  return photosRepo.pendingQuery(userId).all().length;
}

async function editNote(phone: Phone, clientId: string | null, note: string) {
  usePhone(phone);
  const local = await photosRepo.findByClientId(clientId!, USER);
  await photosRepo.update(local!.id, { note });
  advance();
}

async function deletePhoto(phone: Phone, clientId: string | null) {
  usePhone(phone);
  const local = await photosRepo.findByClientId(clientId!, USER);
  await photosRepo.remove(local!.id, USER);
  advance();
}

beforeEach(() => {
  jest.useFakeTimers({
    now: Date.UTC(2026, 10, 4, 12),
    doNotFake: [
      'nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
      'setTimeout', 'clearTimeout', 'queueMicrotask', 'performance', 'hrtime',
    ],
  });
  cloud.reset();
  A = createPhone('A');
  B = createPhone('B');
});

afterEach(() => {
  jest.useRealTimers();
  A.sqlite.close();
  B.sqlite.close();
});

describe('Matriz de pruebas C6', () => {
  test('1. Foto tomada sin conexión; al reconectar se sube y pendientes vuelve a 0', async () => {
    cloud.online = false;
    const photo = await takePhoto(A, 'sin red');
    await takePhoto(A, 'sin red 2');
    expect(pendingCount(A)).toBe(2);
    expect(visible(A)).toHaveLength(2); // la app sigue siendo usable

    await expect(sync(A)).rejects.toThrow();
    expect(pendingCount(A)).toBe(2);
    expect(cloud.rows).toHaveLength(0);

    cloud.online = true;
    const result = await sync(A);

    expect(result.pushed).toBe(2);
    expect(pendingCount(A)).toBe(0);
    expect(cloud.liveRows()).toHaveLength(2);
    expect(cloud.files.has(`${USER}/${photo.clientId}.jpg`)).toBe(true);
  });

  test('2. Foto creada en A aparece en B con imagen y ubicación', async () => {
    const photo = await takePhoto(A, 'de A');
    await sync(A);

    const result = await sync(B);
    const [copy] = visible(B);

    expect(result.pulled).toBe(1);
    expect(copy.clientId).toBe(photo.clientId);
    expect(copy.note).toBe('de A');
    expect(copy.latitude).toBeCloseTo(11.5444);
    expect(copy.longitude).toBeCloseTo(-72.9072);
    expect(B.files.has(copy.uri)).toBe(true); // la imagen está descargada
    expect(pendingCount(B)).toBe(0); // nace sincronizada: no se vuelve a subir
  });

  describe('3. Nota editada en A y después en B, ambos sin conexión', () => {
    async function prepare() {
      const photo = await takePhoto(A, 'original');
      await sync(A);
      await sync(B);
      await editNote(A, photo.clientId, 'nota de A');
      await editNote(B, photo.clientId, 'nota de B');
      return photo;
    }

    test.each([
      ['A reconecta primero', () => [A, B, A]],
      ['B reconecta primero', () => [B, A, B]],
    ])('%s: en los dos queda la nota de B', async (_name, order) => {
      const photo = await prepare();
      for (const phone of order()) await sync(phone);

      expect(visible(A)[0].note).toBe('nota de B');
      expect(visible(B)[0].note).toBe('nota de B');
      expect(cloud.row(photo.clientId)!.note).toBe('nota de B');
      expect(cloud.rows).toHaveLength(1);
      expect(pendingCount(A) + pendingCount(B)).toBe(0);
    });
  });

  test('4. Foto borrada en A desaparece en B y del bucket', async () => {
    const photo = await takePhoto(A);
    await sync(A);
    await sync(B);
    const copyUri = visible(B)[0].uri;
    const path = `${USER}/${photo.clientId}.jpg`;
    expect(cloud.files.has(path)).toBe(true);

    await deletePhoto(A, photo.clientId);
    expect(visible(A)).toHaveLength(0); // la UI la oculta de inmediato
    expect(A.files.has(photo.uri)).toBe(true); // el archivo espera a que la marca se sincronice

    await sync(A);
    expect(cloud.row(photo.clientId)!.deleted_at).not.toBeNull(); // la fila queda como marca
    expect(cloud.files.has(path)).toBe(false);
    expect(A.files.has(photo.uri)).toBe(false);

    await sync(B);
    expect(visible(B)).toHaveLength(0);
    expect(B.files.has(copyUri)).toBe(false);
    expect(pendingCount(B)).toBe(0);
  });

  describe('5. Editada en A y borrada después en B, ambos sin conexión', () => {
    test.each([
      ['A reconecta primero', () => [A, B, A]],
      ['B reconecta primero', () => [B, A, B]],
    ])('%s: queda borrada en los dos', async (_name, order) => {
      const photo = await takePhoto(A);
      await sync(A);
      await sync(B);
      await editNote(A, photo.clientId, 'editada');
      await deletePhoto(B, photo.clientId);

      for (const phone of order()) await sync(phone);

      expect(visible(A)).toHaveLength(0);
      expect(visible(B)).toHaveLength(0);
      expect(cloud.row(photo.clientId)!.deleted_at).not.toBeNull();
      expect(cloud.files.size).toBe(0);
      expect(pendingCount(A) + pendingCount(B)).toBe(0);
    });
  });

  test('6. Se corta la red en cualquier punto de una sincronización de 5 fotos', async () => {
    // Una sincronización limpia de 5 fotos hace 1 bajada + 5 × (archivo + fila) = 11 peticiones
    for (let cutAfter = 0; cutAfter <= 10; cutAfter++) {
      cloud.reset();
      const phone = createPhone(`corte-${cutAfter}`);
      for (let i = 0; i < 5; i++) await takePhoto(phone);

      cloud.cutAfter = cutAfter;
      await expect(sync(phone)).rejects.toThrow();
      expect(cloud.online).toBe(false);

      cloud.cutAfter = null;
      cloud.online = true;
      await sync(phone);

      expect(pendingCount(phone)).toBe(0);
      expect(cloud.rows).toHaveLength(5);
      expect(new Set(cloud.rows.map((row) => row.client_id)).size).toBe(5);
      expect(cloud.files.size).toBe(5);
      phone.sqlite.close();
    }
  });

  test('7. Las pendientes sobreviven al cierre: al abrir con red, un ciclo las sube', async () => {
    // Que el ciclo se dispare solo al abrir está probado en useSync.triggers.test.tsx
    const file = path.join(os.tmpdir(), `geocam-test-${process.pid}-${Date.now()}.db`);
    const phone = createPhoneOnDisk('disco', file);
    try {
      cloud.online = false;
      await takePhoto(phone, 'antes de cerrar');
      expect(pendingCount(phone)).toBe(1);

      reopenPhone(phone, file); // se cierra la app y se abre de nuevo, ya con red
      cloud.online = true;
      expect(pendingCount(phone)).toBe(1);

      const result = await sync(phone);

      expect(result.pushed).toBe(1);
      expect(cloud.liveRows().map((row) => row.note)).toEqual(['antes de cerrar']);
      expect(pendingCount(phone)).toBe(0);
    } finally {
      phone.sqlite.close();
      fs.rmSync(file, { force: true });
    }
  });
});

describe('C5. Errores por foto', () => {
  test('la que falla queda pendiente, las demás continúan y se reintenta en el siguiente ciclo', async () => {
    const ok1 = await takePhoto(A, 'ok 1');
    const bad = await takePhoto(A, 'falla');
    const ok2 = await takePhoto(A, 'ok 2');
    const badPath = `${USER}/${bad.clientId}.jpg`;
    cloud.rejectUploads.add(badPath);

    const error = await sync(A).catch((e) => e);

    expect(error).toBeInstanceOf(SyncFailuresError);
    expect(error.failures).toEqual([{ clientId: bad.clientId, message: 'Internal server error' }]);
    expect(cloud.row(ok1.clientId)).toBeDefined();
    expect(cloud.row(ok2.clientId)).toBeDefined();
    expect(cloud.row(bad.clientId)).toBeUndefined();
    expect(pendingCount(A)).toBe(1);

    cloud.rejectUploads.delete(badPath);
    await sync(A);
    expect(cloud.row(bad.clientId)).toBeDefined();
    expect(pendingCount(A)).toBe(0);
  });

  test('el resultado con los errores queda guardado para la pantalla de estado', async () => {
    const bad = await takePhoto(A);
    cloud.rejectUploads.add(`${USER}/${bad.clientId}.jpg`);
    await sync(A).catch(() => {});

    usePhone(A);
    const saved = JSON.parse((await syncMetaRepo.get(lastResultKey(USER)))!);
    expect(saved.failures).toHaveLength(1);
    expect(saved.finishedAt).toBeGreaterThan(0);
  });

  test('una foto que no se puede bajar no detiene a las demás y se reintenta', async () => {
    const broken = await takePhoto(A, 'archivo perdido');
    const fine = await takePhoto(A, 'bien');
    await sync(A);
    const path = `${USER}/${broken.clientId}.jpg`;
    const bytes = cloud.files.get(path)!;
    cloud.files.delete(path);

    await expect(sync(B)).rejects.toBeInstanceOf(SyncFailuresError);
    expect(visible(B).map((photo) => photo.clientId)).toEqual([fine.clientId]);

    cloud.files.set(path, bytes);
    await sync(B);
    expect(visible(B)).toHaveLength(2);
  });
});

describe('Diseño de la sincronización', () => {
  test('repetir la sincronización no duplica filas ni archivos', async () => {
    await takePhoto(A);
    await sync(A);
    const requestsBefore = cloud.requests;
    for (let i = 0; i < 3; i++) await sync(A);

    expect(cloud.rows).toHaveLength(1);
    expect(cloud.files.size).toBe(1);
    expect(visible(A)).toHaveLength(1);
    expect(cloud.requests - requestsBefore).toBe(3); // solo una bajada por ciclo: nada que subir
  });

  test('se baja antes de subir: un cambio local viejo no pisa uno remoto más nuevo', async () => {
    const photo = await takePhoto(A, 'original');
    await sync(A);
    await sync(B);
    await editNote(A, photo.clientId, 'vieja');
    await editNote(B, photo.clientId, 'nueva');
    await sync(B);
    const versionInCloud = cloud.row(photo.clientId)!.server_updated_at;

    await sync(A);

    expect(cloud.row(photo.clientId)!.note).toBe('nueva');
    expect(cloud.row(photo.clientId)!.server_updated_at).toBe(versionInCloud); // A no subió nada
    expect(visible(A)[0].note).toBe('nueva');
  });

  test('una edición hecha durante la subida no se pierde', async () => {
    const photo = await takePhoto(A, 'versión 1');
    const originalUpsert = cloud.upsert.bind(cloud);
    cloud.upsert = (row) => {
      const answer = originalUpsert(row);
      cloud.upsert = originalUpsert;
      // El usuario edita justo después de que la fila salió del teléfono
      A.sqlite
        .prepare('UPDATE photos SET note = ?, updated_at = ? WHERE client_id = ?')
        .run('versión 2', Date.now() + 1000, photo.clientId);
      return answer;
    };

    await sync(A);
    expect(pendingCount(A)).toBe(1); // syncedAt es la versión subida, no "ahora"

    await sync(A);
    expect(cloud.row(photo.clientId)!.note).toBe('versión 2');
    expect(pendingCount(A)).toBe(0);
  });

  test('llamadas simultáneas comparten el ciclo y un cambio que llega durante él se sube', async () => {
    const photo = await takePhoto(A);
    usePhone(A);
    const first = syncAll(USER);
    const second = syncAll(USER);
    await Promise.all([first, second]);

    expect(cloud.rows).toHaveLength(1);
    expect(cloud.files.size).toBe(1);
    expect(cloud.row(photo.clientId)).toBeDefined();
  });

  test('un cambio remoto que llega tarde con hora vieja igual se baja (cursor del servidor)', async () => {
    const photo = await takePhoto(A, 'original');
    await sync(A);
    await sync(B);
    // A edita sin conexión el "lunes"
    await editNote(A, photo.clientId, 'editada sin red');
    // B sincroniza el "martes": su cursor avanza
    await takePhoto(B, 'otra');
    await sync(B);
    // A sube el "miércoles": updated_at es del lunes, pero server_updated_at es de ahora
    await sync(A);

    await sync(B);
    const note = visible(B).find((row) => row.clientId === photo.clientId)!.note;
    expect(note).toBe('editada sin red');
  });

  test('con fechas iguales no gana nadie y la bajada de más de una página llega completa', async () => {
    const created: (string | null)[] = [];
    for (let i = 0; i < 205; i++) {
      const row = await takePhoto(A, `foto ${i}`);
      created.push(row.clientId);
    }
    await sync(A);

    const result = await sync(B);
    expect(result.pulled).toBe(205);
    expect(pendingCount(B)).toBe(0);

    const again = await sync(B);
    expect(again.pulled).toBe(0);
  });

  test('un reloj atrasado no pierde la edición: la versión siempre avanza', async () => {
    const photo = await takePhoto(A, 'original');
    await sync(A);
    jest.setSystemTime(Date.now() - 24 * 60 * 60 * 1000); // el reloj se atrasa un día
    await editNote(A, photo.clientId, 'con reloj atrasado');

    expect(pendingCount(A)).toBe(1);
    await sync(A);
    expect(cloud.row(photo.clientId)!.note).toBe('con reloj atrasado');
  });
});

describe('Borrados: casos borde', () => {
  test('borrada en A y editada después en B: gana la edición y la foto revive con su archivo', async () => {
    const photo = await takePhoto(A, 'original');
    await sync(A);
    await sync(B);
    await deletePhoto(A, photo.clientId);
    await editNote(B, photo.clientId, 'la edición es el último cambio');

    await sync(A); // la marca sube y el archivo sale del bucket
    expect(cloud.files.size).toBe(0);

    await sync(B); // el cambio de B es más nuevo: revive y vuelve a subir el archivo
    expect(cloud.row(photo.clientId)!.deleted_at).toBeNull();
    expect(cloud.files.size).toBe(1);

    await sync(A);
    const [copy] = visible(A);
    expect(copy.note).toBe('la edición es el último cambio');
    expect(A.files.has(copy.uri)).toBe(true);
    expect(pendingCount(A) + pendingCount(B)).toBe(0);
  });

  test('borrada localmente y editada después en otro teléfono: se restaura la foto', async () => {
    const photo = await takePhoto(A, 'original');
    await sync(A);
    await sync(B);
    await deletePhoto(A, photo.clientId);
    await editNote(B, photo.clientId, 'más nueva');
    await sync(B);

    await sync(A);
    const [copy] = visible(A);
    expect(copy.note).toBe('más nueva');
    expect(A.files.has(copy.uri)).toBe(true); // el archivo seguía ahí: la marca no se había subido
    expect(cloud.row(photo.clientId)!.deleted_at).toBeNull();
    expect(cloud.files.size).toBe(1);
  });

  test('un teléfono nuevo no crea ni descarga las fotos que ya están borradas', async () => {
    const photo = await takePhoto(A);
    await sync(A);
    await deletePhoto(A, photo.clientId);
    await sync(A);

    const result = await sync(B);
    expect(result.pulled).toBe(0);
    expect(visible(B)).toHaveLength(0);
    expect(B.files.size).toBe(0);
  });

  test('si se corta después de subir la marca, el archivo se elimina en el siguiente ciclo', async () => {
    const photo = await takePhoto(A);
    await sync(A);
    await deletePhoto(A, photo.clientId);

    cloud.cutAfter = cloud.requests + 2; // bajada + marca; falla al borrar del bucket
    await expect(sync(A)).rejects.toBeInstanceOf(SyncFailuresError);
    expect(cloud.row(photo.clientId)!.deleted_at).not.toBeNull();
    expect(cloud.files.size).toBe(1);
    expect(pendingCount(A)).toBe(0);

    cloud.cutAfter = null;
    cloud.online = true;
    const result = await sync(A);
    expect(result.purged).toBe(1);
    expect(cloud.files.size).toBe(0);
    expect(A.files.has(photo.uri)).toBe(false);
  });

  test('borrar todo (agitar) llega a los demás teléfonos', async () => {
    await takePhoto(A);
    await takePhoto(A);
    await sync(A);
    await sync(B);

    usePhone(A);
    await photosRepo.clearAll(USER);
    advance();
    await sync(A);
    await sync(B);

    expect(visible(A)).toHaveLength(0);
    expect(visible(B)).toHaveLength(0);
    expect(cloud.files.size).toBe(0);
    expect(cloud.liveRows()).toHaveLength(0);
  });

  test('borrar una foto no toca las demás, con cuenta o como invitado', async () => {
    for (const userId of [USER, 'local_guest']) {
      await takePhoto(A, 'primera', userId);
      const middle = await takePhoto(A, 'la del medio', userId);
      await takePhoto(A, 'última', userId);

      usePhone(A);
      await photosRepo.remove(middle.id, userId);

      expect(visible(A, userId).map((photo) => photo.note).sort()).toEqual(['primera', 'última']);
    }
  });

  test('el invitado borra de una vez y nada pasa por la nube', async () => {
    const photo = await takePhoto(A, null, 'local_guest');
    usePhone(A);
    await photosRepo.remove(photo.id, 'local_guest');

    expect(A.sqlite.prepare('SELECT count(*) AS n FROM photos').get()).toEqual({ n: 0 });
    expect(currentPhone().files.has(photo.uri)).toBe(false);
    expect(cloud.requests).toBe(0);
  });
});

describe('Separación por usuario', () => {
  test('la sincronización de un usuario no toca las fotos de otro ni las del invitado', async () => {
    await takePhoto(A, 'de user');
    await takePhoto(A, 'de otro', OTHER_USER);
    await takePhoto(A, 'de invitado', 'local_guest');

    await sync(A, USER);

    expect(cloud.rows.map((row) => row.note)).toEqual(['de user']);
    expect(pendingCount(A, OTHER_USER)).toBe(1);
    expect(pendingCount(A, 'local_guest')).toBe(1);

    await sync(B, OTHER_USER);
    expect(visible(B, OTHER_USER)).toHaveLength(0); // RLS: otro usuario no baja filas ajenas
  });
});
