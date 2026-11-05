// Sincronización en dos sentidos entre SQLite (fuente de verdad) y Supabase.
// Cada ciclo: 1) bajar lo que cambió en la nube, 2) subir lo pendiente, 3) eliminar los archivos
// de los borrados que ya quedaron sincronizados. Conflictos: gana el último cambio (syncRules.ts).
import { photosRepo } from '@/db/repositories/photos';
import { syncMetaRepo } from '@/db/repositories/syncMeta';
import {
  fetchChangesSince,
  removeRemoteFile,
  signedUrl,
  uploadPhotoBytes,
  upsertRemotePhoto,
  type RemotePhoto,
} from '@/services/cloudPhotos';
import { deletePhotoFile, downloadPhotoFile, readPhotoBytes } from '@/services/photoFiles';
import { decidePull } from '@/services/syncRules';

const PULL_PAGE_SIZE = 200;
const MAX_ROUNDS = 3;
const EPOCH = '1970-01-01T00:00:00Z';
/**
 * Una transacción puede confirmarse después de otra que empezó más tarde, así que una fila
 * puede aparecer con una hora anterior al cursor. Releer unos segundos cubre ese caso, y es
 * gratis porque aplicar la misma versión dos veces no hace nada.
 */
const CURSOR_OVERLAP_MS = 5_000;

export interface SyncFailure {
  clientId: string;
  message: string;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  purged: number;
  failures: SyncFailure[];
  error: string | null;
  finishedAt: number;
}

export const cursorKey = (userId: string) => `lastPulledAt:${userId}`;
export const lastResultKey = (userId: string) => `lastSyncResult:${userId}`;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String((error as any)?.message ?? error);
}

const startFrom = (saved: string | null) =>
  saved ? new Date(new Date(saved).getTime() - CURSOR_OVERLAP_MS).toISOString() : EPOCH;

async function applyRemoteRow(userId: string, remote: RemotePhoto): Promise<boolean> {
  const local = await photosRepo.findByClientId(remote.client_id, userId);
  const remoteUpdatedAt = new Date(remote.updated_at);

  switch (decidePull(local, remote)) {
    case 'insert': {
      const uri = await downloadPhotoFile(await signedUrl(remote.storage_path), remote.client_id);
      await photosRepo.insertFromRemote({
        userId,
        clientId: remote.client_id,
        uri,
        latitude: remote.latitude,
        longitude: remote.longitude,
        accuracy: remote.accuracy,
        source: remote.source,
        note: remote.note,
        favorite: remote.favorite,
        createdAt: new Date(remote.client_created_at),
        updatedAt: remoteUpdatedAt,
        remotePath: remote.storage_path,
        syncedAt: remoteUpdatedAt,
      });
      return true;
    }
    case 'apply':
      await photosRepo.applyRemote(local!.id, {
        note: remote.note,
        favorite: remote.favorite,
        remotePath: remote.storage_path || local!.remotePath,
        deletedAt: remote.deleted_at ? new Date(remote.deleted_at) : null,
        updatedAt: remoteUpdatedAt,
        syncedAt: remoteUpdatedAt,
      });
      return true;
    case 'revive':
      await photosRepo.markForReupload(local!.id);
      return false;
    default:
      return false;
  }
}

/**
 * Bajar. Una fila que falla (por ejemplo, su archivo no se pudo descargar) no detiene a las
 * demás, pero el cursor guardado ya no avanza más allá de ella: el siguiente ciclo la reintenta.
 */
async function pull(userId: string, failures: SyncFailure[]): Promise<number> {
  const key = cursorKey(userId);
  let since = startFrom(await syncMetaRepo.get(key));
  let blocked = false;
  let applied = 0;

  for (;;) {
    const rows = await fetchChangesSince(userId, since, PULL_PAGE_SIZE);

    for (const remote of rows) {
      try {
        if (await applyRemoteRow(userId, remote)) applied++;
        if (!blocked) await syncMetaRepo.set(key, remote.server_updated_at);
      } catch (error) {
        blocked = true;
        failures.push({ clientId: remote.client_id, message: messageOf(error) });
      }
    }

    if (rows.length < PULL_PAGE_SIZE) return applied;
    since = rows[rows.length - 1].server_updated_at;
  }
}

/** Subir. Idempotente y foto por foto: la que falla queda pendiente y las demás continúan. */
async function push(userId: string, failures: SyncFailure[]): Promise<number> {
  const pending = await photosRepo.listPending(userId);
  let pushed = 0;

  for (const photo of pending) {
    const clientId = photo.clientId;
    if (!clientId) continue;

    try {
      const path = photo.remotePath ?? `${userId}/${clientId}.jpg`;
      const version = photo.updatedAt ?? photo.createdAt;

      // 1. El archivo solo se sube la primera vez, y una marca de borrado no sube archivo
      if (!photo.remotePath && !photo.deletedAt) {
        await uploadPhotoBytes(path, await readPhotoBytes(photo.uri));
      }

      // 2. La marca de borrado viaja en la misma fila
      await upsertRemotePhoto({
        client_id: clientId,
        user_id: userId,
        storage_path: path,
        latitude: photo.latitude,
        longitude: photo.longitude,
        accuracy: photo.accuracy,
        source: photo.source,
        note: photo.note,
        favorite: photo.favorite,
        client_created_at: photo.createdAt.toISOString(),
        updated_at: version.toISOString(),
        deleted_at: photo.deletedAt?.toISOString() ?? null,
      });

      // 3. syncedAt = la versión que se subió, no "ahora"
      await photosRepo.markSynced(photo.id, path, version);
      pushed++;
    } catch (error) {
      failures.push({ clientId, message: messageOf(error) });
    }
  }
  return pushed;
}

/**
 * Elimina los archivos de los borrados ya sincronizados. Corre en todos los teléfonos y es
 * idempotente: borrar del bucket un archivo que ya no está no da error. Si se corta aquí, la
 * fila local sigue marcada y el siguiente ciclo termina el trabajo.
 */
async function purge(userId: string, failures: SyncFailure[]): Promise<number> {
  const rows = await photosRepo.listPurgeable(userId);
  let purged = 0;

  for (const photo of rows) {
    try {
      if (photo.remotePath) await removeRemoteFile(photo.remotePath);
      await photosRepo.deleteRow(photo.id);
      deletePhotoFile(photo.uri);
      purged++;
    } catch (error) {
      failures.push({ clientId: photo.clientId ?? String(photo.id), message: messageOf(error) });
    }
  }
  return purged;
}

/** Algunas fotos fallaron. Es un error para que TanStack Query reintente el ciclo completo. */
export class SyncFailuresError extends Error {
  constructor(public readonly failures: SyncFailure[]) {
    super(
      failures.length === 1
        ? '1 foto no se pudo sincronizar'
        : `${failures.length} fotos no se pudieron sincronizar`
    );
    this.name = 'SyncFailuresError';
  }
}

const running = new Map<string, Promise<SyncResult>>();
const rerunRequested = new Set<string>();

async function runSync(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    pulled: 0,
    pushed: 0,
    purged: 0,
    failures: [],
    error: null,
    finishedAt: 0,
  };

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      rerunRequested.delete(userId);
      result.failures = [];
      result.pulled += await pull(userId, result.failures); // primero bajar...
      result.pushed += await push(userId, result.failures); // ...después subir
      result.purged += await purge(userId, result.failures);
      if (!rerunRequested.has(userId)) break;
    }
  } catch (error) {
    result.error = messageOf(error);
  }

  result.finishedAt = Date.now();
  await syncMetaRepo.set(lastResultKey(userId), JSON.stringify(result));

  if (result.error) throw new Error(result.error);
  if (result.failures.length > 0) throw new SyncFailuresError(result.failures);
  return result;
}

/**
 * Un ciclo completo. Seguro de llamar varias veces seguidas: si ya hay uno en curso se reutiliza
 * y, como pudo llegar un cambio que ese ciclo no vio, se pide una vuelta más al terminar.
 */
export function syncAll(userId: string): Promise<SyncResult> {
  const current = running.get(userId);
  if (current) {
    rerunRequested.add(userId);
    return current;
  }

  const cycle = runSync(userId).finally(() => running.delete(userId));
  running.set(userId, cycle);
  return cycle;
}
