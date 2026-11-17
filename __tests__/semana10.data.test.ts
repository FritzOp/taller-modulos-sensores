// Semana 10 con SQLite real y las migraciones reales:
// T5 (la descripción viaja con la sincronización) y C1 (historial del chat).
import { chatRepo, type StoredMessage } from '@/db/repositories/chat';
import { photosRepo } from '@/db/repositories/photos';
import { syncAll } from '@/services/sync';
import { cloud, createPhone, fakePhotoFiles, usePhone, USER, type Phone } from './helpers/world';

jest.mock('@/db/client', () => ({ db: require('./helpers/world').proxyDb }));
jest.mock('@/services/supabase', () => ({ supabase: require('./helpers/world').fakeSupabase }));
jest.mock('@/services/photoFiles', () => require('./helpers/world').fakePhotoFiles);
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

let A: Phone;
let B: Phone;

function advance(ms = 60_000) {
  jest.setSystemTime(Date.now() + ms);
}

async function sync(phone: Phone) {
  usePhone(phone);
  cloud.sessionUser = USER;
  return syncAll(USER);
}

async function takePhoto(phone: Phone) {
  usePhone(phone);
  const uri = fakePhotoFiles.persistPhoto(`file://${phone.name}/${Math.random()}.jpg`);
  const [row] = await photosRepo.create({ userId: USER, uri, source: 'camera', latitude: 1, longitude: 2 });
  advance();
  return row;
}

beforeEach(() => {
  jest.useFakeTimers({
    now: Date.UTC(2026, 10, 16, 12),
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

describe('T5. La descripción con IA viaja con la sincronización', () => {
  test('guardarla deja la foto pendiente: sin eso, nunca saldría del teléfono', async () => {
    const photo = await takePhoto(A);
    await sync(A);
    usePhone(A);
    expect(photosRepo.pendingQuery(USER).all()).toHaveLength(0);

    await photosRepo.setDescription(photo.id, '  Atardecer sobre el mar  ');
    advance();

    const pendiente = photosRepo.pendingQuery(USER).all();
    expect(pendiente).toHaveLength(1);
    expect(pendiente[0].aiDescription).toBe('Atardecer sobre el mar');
  });

  test('sube a la nube y baja al otro teléfono', async () => {
    const photo = await takePhoto(A);
    usePhone(A);
    await photosRepo.setDescription(photo.id, 'Un faro al atardecer');
    advance();
    await sync(A);

    expect(cloud.row(photo.clientId)!.ai_description).toBe('Un faro al atardecer');

    await sync(B);
    usePhone(B);
    expect(photosRepo.listQuery(USER).all()[0].aiDescription).toBe('Un faro al atardecer');
  });

  test('editada en otro teléfono, la versión más reciente gana como la nota', async () => {
    const photo = await takePhoto(A);
    usePhone(A);
    await photosRepo.setDescription(photo.id, 'Sugerencia de la IA');
    advance();
    await sync(A);
    await sync(B);

    usePhone(B);
    const copia = await photosRepo.findByClientId(photo.clientId!, USER);
    await photosRepo.setDescription(copia!.id, 'Corregida a mano');
    advance();
    await sync(B);
    await sync(A);

    usePhone(A);
    expect(photosRepo.listQuery(USER).all()[0].aiDescription).toBe('Corregida a mano');
  });

  test('borrarla también se sincroniza', async () => {
    const photo = await takePhoto(A);
    usePhone(A);
    await photosRepo.setDescription(photo.id, 'Algo');
    advance();
    await sync(A);
    usePhone(A);
    await photosRepo.setDescription(photo.id, '   ');
    advance();
    await sync(A);

    expect(cloud.row(photo.clientId)!.ai_description).toBeNull();
  });
});

describe('C1. Historial del chat en SQLite', () => {
  const texto = (id: string, role: StoredMessage['role'], text: string): StoredMessage => ({
    id,
    role,
    parts: [{ type: 'text', text }],
  });

  test('al reabrir sigue donde iba, en el mismo orden y con las fotos', async () => {
    usePhone(A);
    const conversacion = await chatRepo.create(USER);
    const foto = { type: 'file', mediaType: 'image/jpeg', url: 'data:image/jpeg;base64,AAAA' };
    await chatRepo.save(conversacion.id, [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: '¿Qué ves?' }, foto] },
      texto('a1', 'assistant', 'Un atardecer.'),
    ]);

    const latest = await chatRepo.latest(USER);
    expect(latest!.id).toBe(conversacion.id);
    expect(latest!.title).toBe('¿Qué ves?');
    expect(await chatRepo.messages(conversacion.id)).toEqual([
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: '¿Qué ves?' }, foto] },
      texto('a1', 'assistant', 'Un atardecer.'),
    ]);
  });

  test('guardar de nuevo es un upsert: no duplica, y la respuesta que crece se actualiza', async () => {
    usePhone(A);
    const { id } = await chatRepo.create(USER);
    await chatRepo.save(id, [texto('u1', 'user', 'Hola'), texto('a1', 'assistant', 'Ho')]);
    await chatRepo.save(id, [texto('u1', 'user', 'Hola'), texto('a1', 'assistant', 'Hola, ¿qué tal?')]);

    const mensajes = await chatRepo.messages(id);
    expect(mensajes).toHaveLength(2);
    expect(mensajes[1].parts).toEqual([{ type: 'text', text: 'Hola, ¿qué tal?' }]);
  });

  test('al regenerar, la respuesta reemplazada desaparece', async () => {
    usePhone(A);
    const { id } = await chatRepo.create(USER);
    await chatRepo.save(id, [texto('u1', 'user', 'Hola'), texto('a1', 'assistant', 'Respuesta vieja')]);
    await chatRepo.save(id, [texto('u1', 'user', 'Hola'), texto('a2', 'assistant', 'Respuesta nueva')]);

    expect((await chatRepo.messages(id)).map((m) => m.id)).toEqual(['u1', 'a2']);
  });

  test('"Nueva conversación" empieza vacía y la anterior se conserva', async () => {
    usePhone(A);
    const vieja = await chatRepo.create(USER);
    await chatRepo.save(vieja.id, [texto('u1', 'user', 'Primera')]);
    advance();
    const nueva = await chatRepo.create(USER);

    expect((await chatRepo.latest(USER))!.id).toBe(nueva.id);
    expect(await chatRepo.messages(nueva.id)).toEqual([]);
    expect(await chatRepo.messages(vieja.id)).toHaveLength(1);
  });

  test('cada usuario solo ve sus conversaciones', async () => {
    usePhone(A);
    await chatRepo.create(USER);
    expect(await chatRepo.latest('otro-usuario')).toBeUndefined();
  });
});
