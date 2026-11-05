// ¿Cuándo se dispara la sincronización? Código real de useSync y de lib/queryClient.
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { requestSync, useSync } from '@/hooks/useSync';
import { queryClient } from '@/lib/queryClient';
import { syncAll } from '@/services/sync';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
}));
jest.mock('@/services/sync', () => ({
  syncAll: jest.fn(),
  lastResultKey: (userId: string) => `lastSyncResult:${userId}`,
}));
jest.mock('@/db/repositories/photos', () => ({ photosRepo: { pendingQuery: jest.fn(() => 'pending') } }));
jest.mock('@/db/repositories/syncMeta', () => ({ syncMetaRepo: { byKeyQuery: jest.fn(() => 'meta') } }));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: (query: string) => ({ data: query === 'pending' ? [{ id: 1 }, { id: 2 }] : [] }),
}));

const mockAuth = { user: { id: 'usuario' } as { id: string } | null };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));

const syncMock = syncAll as jest.Mock;
const result = { pulled: 0, pushed: 0, purged: 0, failures: [], error: null, finishedAt: 1 };

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

async function setup() {
  const hook = await renderHook(() => useSync(), { wrapper });
  await waitFor(() => expect(syncMock).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(hook.result.current.isSyncing).toBe(false));
  return hook;
}

beforeEach(() => {
  queryClient.clear();
  queryClient.setDefaultOptions({ queries: { retryDelay: 1 } });
  syncMock.mockReset();
  syncMock.mockResolvedValue(result);
  mockAuth.user = { id: 'usuario' };
  onlineManager.setOnline(true);
  focusManager.setFocused(true);
});

describe('Disparadores de la sincronización', () => {
  test('al abrir la app con sesión (escenario 7 de la matriz)', async () => {
    await setup();
    expect(syncMock).toHaveBeenCalledWith('usuario');
  });

  test('el invitado nunca sincroniza', async () => {
    mockAuth.user = null;
    await renderHook(() => useSync(), { wrapper });
    await act(async () => {
      requestSync();
    });
    expect(syncMock).not.toHaveBeenCalled();
  });

  test('al recuperar la red, sin tocar ningún botón', async () => {
    await setup();
    await act(async () => onlineManager.setOnline(false));
    await act(async () => onlineManager.setOnline(true));
    await waitFor(() => expect(syncMock).toHaveBeenCalledTimes(2));
  });

  test('al volver a primer plano', async () => {
    await setup();
    await act(async () => focusManager.setFocused(false));
    await act(async () => focusManager.setFocused(true));
    await waitFor(() => expect(syncMock).toHaveBeenCalledTimes(2));
  });

  test('después de cada cambio local', async () => {
    await setup();
    await act(async () => requestSync());
    await waitFor(() => expect(syncMock).toHaveBeenCalledTimes(2));
  });

  test('un cambio sin conexión queda en pausa y se sube solo al reconectar', async () => {
    const { result: hook } = await setup();
    await act(async () => onlineManager.setOnline(false));
    await act(async () => requestSync());

    await waitFor(() => expect(hook.current.isPaused).toBe(true));
    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(hook.current.isOnline).toBe(false);
    expect(hook.current.pendingCount).toBe(2);

    await act(async () => onlineManager.setOnline(true));
    await waitFor(() => expect(syncMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hook.current.isPaused).toBe(false));
  });

  test('si falla, TanStack Query reintenta y luego expone el error', async () => {
    syncMock.mockRejectedValue(new Error('falló'));
    const { result: hook } = await renderHook(() => useSync(), { wrapper });

    await waitFor(() => expect(hook.current.error?.message).toBe('falló'));
    expect(syncMock).toHaveBeenCalledTimes(3); // el intento y 2 reintentos
  });

  test('montar otra pantalla que observa el estado no dispara otro ciclo', async () => {
    await setup();
    await renderHook(() => useSync(), { wrapper });
    await act(async () => {});
    expect(syncMock).toHaveBeenCalledTimes(1);
  });
});
