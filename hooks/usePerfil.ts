import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useAuth } from '@/context/AuthContext';
import { syncMetaRepo } from '@/db/repositories/syncMeta';
import { leerPerfilGuardado, perfilKey, type Perfil } from '@/services/ai/perfil';

/** C2. El perfil vive en este teléfono y viaja con cada mensaje al asistente. */
export function usePerfil() {
  const { userId } = useAuth();
  const { data = [] } = useLiveQuery(syncMetaRepo.byKeyQuery(perfilKey(userId)), [userId]);
  const perfil = useMemo(() => leerPerfilGuardado(data[0]?.value), [data]);

  const guardar = useCallback(
    (nuevo: Perfil) => syncMetaRepo.set(perfilKey(userId), JSON.stringify(nuevo)),
    [userId]
  );

  return { perfil, guardar };
}

/** Lectura puntual, para el transporte del chat: siempre el perfil vigente. */
export async function leerPerfil(userId: string): Promise<Perfil> {
  return leerPerfilGuardado(await syncMetaRepo.get(perfilKey(userId)));
}
