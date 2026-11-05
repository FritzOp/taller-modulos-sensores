// Paginación por cursor y búsqueda: código real de services/cloudPhotos.ts contra el servidor en memoria.
import { CLOUD_PAGE_SIZE, listCloudPage } from '@/services/cloudPhotos';
import { cloud, OTHER_USER, USER } from './helpers/world';

jest.mock('@/services/supabase', () => ({ supabase: require('./helpers/world').fakeSupabase }));

function addPhoto(index: number, overrides: Record<string, unknown> = {}) {
  const clientId = `foto-${index}`;
  const storagePath = `${USER}/${clientId}.jpg`;
  cloud.files.set(storagePath, new ArrayBuffer(1));
  cloud.upsert({
    client_id: clientId,
    user_id: USER,
    storage_path: storagePath,
    latitude: 1,
    longitude: 2,
    note: `nota ${index}`,
    favorite: false,
    client_created_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    updated_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    deleted_at: null,
    ...overrides,
  });
  return clientId;
}

const page = (cursor: string | null = null, search = '') =>
  listCloudPage({ userId: USER, cursor, search });

beforeEach(() => cloud.reset());

describe('listCloudPage', () => {
  test('recorre todas las fotos de a 10, de la más reciente a la más antigua', async () => {
    for (let i = 0; i < 25; i++) addPhoto(i);

    const first = await page();
    const second = await page(first.nextCursor);
    const third = await page(second.nextCursor);

    expect(first.items).toHaveLength(CLOUD_PAGE_SIZE);
    expect(first.items[0].client_id).toBe('foto-24');
    expect(second.items).toHaveLength(CLOUD_PAGE_SIZE);
    expect(third.items).toHaveLength(5);
    expect(third.nextCursor).toBeNull();

    const ids = [...first.items, ...second.items, ...third.items].map((item) => item.client_id);
    expect(new Set(ids).size).toBe(25);
  });

  test('una foto nueva durante la paginación no repite ni salta filas (el problema de range)', async () => {
    for (let i = 0; i < 20; i++) addPhoto(i);

    const first = await page();
    addPhoto(100); // llega una foto más reciente mientras el usuario baja por la lista
    const second = await page(first.nextCursor);

    const ids = [...first.items, ...second.items].map((item) => item.client_id);
    expect(new Set(ids).size).toBe(20);
    expect(ids).not.toContain('foto-100');
  });

  test('no muestra las fotos borradas', async () => {
    addPhoto(1);
    addPhoto(2, { deleted_at: new Date().toISOString() });

    const { items } = await page();
    expect(items.map((item) => item.client_id)).toEqual(['foto-1']);
  });

  test('la búsqueda por nota ignora mayúsculas y funciona junto con el cursor', async () => {
    for (let i = 0; i < 15; i++) addPhoto(i, { note: `Playa ${i}` });
    addPhoto(50, { note: 'montaña' });

    const first = await page(null, ' PLAYA ');
    const second = await page(first.nextCursor, 'playa');

    expect(first.items).toHaveLength(10);
    expect(second.items).toHaveLength(5);
    expect([...first.items, ...second.items].every((item) => item.note?.startsWith('Playa'))).toBe(true);
  });

  test('los comodines se buscan como texto normal', async () => {
    addPhoto(1, { note: 'descuento 100%' });
    addPhoto(2, { note: 'descuento 100 pesos' });

    const { items } = await page(null, '100%');
    expect(items.map((item) => item.client_id)).toEqual(['foto-1']);
  });

  test('entrega una URL firmada por foto, sin URL si falta el archivo', async () => {
    addPhoto(1);
    addPhoto(2);
    cloud.files.delete(`${USER}/foto-1.jpg`);

    const { items } = await page();
    expect(items.find((item) => item.client_id === 'foto-2')!.imageUrl).toBe(`signed://${USER}/foto-2.jpg`);
    expect(items.find((item) => item.client_id === 'foto-1')!.imageUrl).toBeNull();
  });

  test('una página vacía no pide URLs ni tiene siguiente', async () => {
    const before = cloud.requests;
    const { items, nextCursor } = await page();
    expect(items).toEqual([]);
    expect(nextCursor).toBeNull();
    expect(cloud.requests - before).toBe(1);
  });

  test('no ve las fotos de otro usuario', async () => {
    addPhoto(1);
    cloud.sessionUser = OTHER_USER;
    expect((await listCloudPage({ userId: OTHER_USER, cursor: null, search: '' })).items).toEqual([]);
  });
});
