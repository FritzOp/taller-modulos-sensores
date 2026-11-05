// Reglas de la sincronización como funciones puras: sin base de datos ni red.

/** Gana el último cambio. Con fechas iguales no gana nadie: ya están sincronizados. */
export function remoteWins(localUpdatedAt: Date | null, remoteUpdatedAt: string): boolean {
  return new Date(remoteUpdatedAt).getTime() > (localUpdatedAt?.getTime() ?? 0);
}

/** Pendiente: nunca sincronizada, o cambiada después de la última subida. */
export function isPending(photo: { syncedAt: Date | null; updatedAt: Date | null }): boolean {
  if (!photo.syncedAt) return true;
  return (photo.updatedAt?.getTime() ?? 0) > photo.syncedAt.getTime();
}

export type PullDecision =
  | 'ignore' // borrada en la nube y no existe aquí: no hay nada que hacer
  | 'insert' // foto nueva de otro teléfono: descargar y crear
  | 'apply' // la nube es más nueva: aplicar nota, favorita y marca de borrado
  | 'revive' // un cambio local le gana a un borrado remoto: hay que volver a subir el archivo
  | 'keep'; // la versión local es igual o más nueva: la subida se encarga

export function decidePull(
  local: { updatedAt: Date | null; deletedAt: Date | null } | undefined,
  remote: { updated_at: string; deleted_at: string | null }
): PullDecision {
  if (!local) return remote.deleted_at ? 'ignore' : 'insert';
  if (remoteWins(local.updatedAt, remote.updated_at)) return 'apply';

  const localIsNewer = (local.updatedAt?.getTime() ?? 0) > new Date(remote.updated_at).getTime();
  if (remote.deleted_at && !local.deletedAt && localIsNewer) return 'revive';
  return 'keep';
}
