// C3: la caché sobrevive al cierre. Opciones reales de lib/queryClient con el persister real.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { persistOptions } from '@/lib/queryClient';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(() => new Promise(() => {})),
}));

const feedKey = ['cloud', 'usuario', { search: '' }];
const feedData = {
  pages: [{ items: [{ client_id: 'foto-1', note: 'guardada' }], nextCursor: 'cursor-1' }],
  pageParams: [null],
};

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { gcTime: persistOptions.maxAge } } });

beforeEach(async () => {
  await AsyncStorage.clear();
  onlineManager.setOnline(true);
});

describe('Caché persistida', () => {
  test('el feed vuelve al abrir la app, con páginas y cursor', async () => {
    const before = newClient();
    before.setQueryData(feedKey, feedData);
    await persistQueryClientSave({ ...persistOptions, queryClient: before });

    const after = newClient();
    await persistQueryClientRestore({ ...persistOptions, queryClient: after });

    expect(after.getQueryData(feedKey)).toEqual(feedData);
  });

  test('el estado de la sincronización no se guarda', async () => {
    const before = newClient();
    before.setQueryData(feedKey, feedData);
    before.setQueryData(['sync', 'usuario'], { pushed: 3 });
    await persistQueryClientSave({ ...persistOptions, queryClient: before });

    const after = newClient();
    await persistQueryClientRestore({ ...persistOptions, queryClient: after });

    expect(after.getQueryData(['sync', 'usuario'])).toBeUndefined();
  });

  test('tampoco se guarda una consulta que falló', async () => {
    const before = newClient();
    await before
      .fetchQuery({ queryKey: ['cloud', 'usuario', { search: 'x' }], queryFn: () => Promise.reject(new Error('no')), retry: false })
      .catch(() => {});
    await persistQueryClientSave({ ...persistOptions, queryClient: before });

    const after = newClient();
    await persistQueryClientRestore({ ...persistOptions, queryClient: after });

    expect(after.getQueryCache().getAll()).toHaveLength(0);
  });

  test('una caché de más de un día se descarta', async () => {
    const before = newClient();
    before.setQueryData(feedKey, feedData);
    await persistQueryClientSave({ ...persistOptions, queryClient: before });

    const now = Date.now();
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now + persistOptions.maxAge + 1);
    const after = newClient();
    await persistQueryClientRestore({ ...persistOptions, queryClient: after });
    spy.mockRestore();

    expect(after.getQueryData(feedKey)).toBeUndefined();
  });
});
