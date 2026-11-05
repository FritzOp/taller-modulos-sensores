import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useAuth } from '@/context/AuthContext';
import { photosRepo } from '@/db/repositories/photos';
import { syncMetaRepo } from '@/db/repositories/syncMeta';
import { queryClient, useIsOnline } from '@/lib/queryClient';
import { lastResultKey, syncAll, type SyncResult } from '@/services/sync';

/** Pide un ciclo de sincronización. Sin red queda en pausa y se reanuda solo al reconectar. */
export function requestSync() {
  queryClient.invalidateQueries({ queryKey: ['sync'] });
}

/**
 * La sincronización tratada como una consulta de TanStack Query: se dispara al abrir la app o
 * iniciar sesión, al recuperar la red y al volver a primer plano, y se reintenta si falla.
 */
export function useSync() {
  const { user } = useAuth();
  const userId = user?.id;
  const isOnline = useIsOnline();

  const { data: pending = [] } = useLiveQuery(photosRepo.pendingQuery(userId ?? ''), [userId]);
  const { data: meta = [] } = useLiveQuery(syncMetaRepo.byKeyQuery(lastResultKey(userId ?? '')), [
    userId,
  ]);

  const sync = useQuery({
    queryKey: ['sync', userId],
    queryFn: () => syncAll(userId!),
    enabled: !!userId,
    staleTime: 0,
    retry: 2,
    refetchOnMount: false, // varias pantallas observan esta consulta: montar una no sincroniza
    refetchOnReconnect: 'always', // volvió la red
    refetchOnWindowFocus: 'always', // la app volvió a primer plano
  });

  // El último resultado se guarda en SQLite: sigue disponible después de cerrar la app
  const lastResult = useMemo<SyncResult | null>(() => {
    const value = meta[0]?.value;
    return value ? (JSON.parse(value) as SyncResult) : null;
  }, [meta]);

  return {
    isOnline,
    pendingCount: pending.length,
    isSyncing: sync.fetchStatus === 'fetching',
    isPaused: sync.fetchStatus === 'paused',
    lastResult,
    error: sync.error,
    syncNow: () => sync.refetch(),
    dataUpdatedAt: sync.dataUpdatedAt,
    errorUpdatedAt: sync.errorUpdatedAt,
  };
}

/**
 * Se monta una sola vez, en las pestañas: mantiene viva la consulta y le avisa al feed de la
 * nube cuando un ciclo termina, porque su contenido pudo cambiar.
 */
export function useSyncEngine() {
  const { dataUpdatedAt, errorUpdatedAt } = useSync();

  useEffect(() => {
    if (dataUpdatedAt || errorUpdatedAt) {
      queryClient.invalidateQueries({ queryKey: ['cloud'] });
    }
  }, [dataUpdatedAt, errorUpdatedAt]);
}
