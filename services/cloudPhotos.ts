import { supabase } from '@/services/supabase';

export const BUCKET = 'geocam-photos';
export const PHOTOS_TABLE = 'geocam_photos';

/** Fila de la tabla remota. */
export interface RemotePhoto {
  client_id: string;
  user_id: string;
  storage_path: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  source: 'camera' | 'gallery';
  note: string | null;
  favorite: boolean;
  client_created_at: string;
  updated_at: string; // reloj del teléfono: decide conflictos
  server_updated_at: string; // reloj del servidor: cursor de bajada
  deleted_at: string | null;
}

export type CloudPhoto = Pick<
  RemotePhoto,
  'client_id' | 'storage_path' | 'latitude' | 'longitude' | 'note' | 'favorite' | 'client_created_at'
> & { imageUrl: string | null };

export interface CloudPage {
  items: CloudPhoto[];
  nextCursor: string | null;
}

export const CLOUD_PAGE_SIZE = 10;
const SIGNED_URL_SECONDS = 60 * 60;

/** Los comodines de ILIKE se buscan como texto normal. */
function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, '\\$&');
}

/** Una página del feed: paginación por cursor ("las 10 anteriores a la última que ya tengo"). */
export async function listCloudPage(params: {
  userId: string;
  cursor: string | null;
  search: string;
}): Promise<CloudPage> {
  let query = supabase
    .from(PHOTOS_TABLE)
    .select('client_id, storage_path, latitude, longitude, note, favorite, client_created_at')
    .eq('user_id', params.userId)
    .is('deleted_at', null)
    .order('client_created_at', { ascending: false })
    .limit(CLOUD_PAGE_SIZE);

  if (params.cursor) query = query.lt('client_created_at', params.cursor);

  const term = params.search.trim();
  if (term) query = query.ilike('note', `%${escapeLike(term)}%`);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Omit<CloudPhoto, 'imageUrl'>[];
  const urls = new Map<string, string>();

  if (rows.length > 0) {
    // El bucket es privado: cada página pide sus URLs firmadas en una sola petición
    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(rows.map((row) => row.storage_path), SIGNED_URL_SECONDS);
    if (signError) throw signError;
    signed?.forEach((item) => {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    });
  }

  return {
    items: rows.map((row) => ({ ...row, imageUrl: urls.get(row.storage_path) ?? null })),
    nextCursor:
      rows.length === CLOUD_PAGE_SIZE ? rows[rows.length - 1].client_created_at : null,
  };
}

/** Filas que llegaron al servidor después del cursor, en orden de llegada. */
export async function fetchChangesSince(
  userId: string,
  since: string,
  limit: number
): Promise<RemotePhoto[]> {
  const { data, error } = await supabase
    .from(PHOTOS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .gt('server_updated_at', since)
    .order('server_updated_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RemotePhoto[];
}

/** upsert por client_id: crea la fila o la actualiza, nunca la duplica. */
export async function upsertRemotePhoto(
  row: Omit<RemotePhoto, 'server_updated_at'>
): Promise<void> {
  const { error } = await supabase.from(PHOTOS_TABLE).upsert(row, { onConflict: 'client_id' });
  if (error) throw error;
}

export async function uploadPhotoBytes(path: string, bytes: ArrayBuffer): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg' });
  // "ya existe": un intento anterior subió el archivo pero no alcanzó a guardar la fila
  if (error && !/exists/i.test(error.message)) throw error;
}

export async function removeRemoteFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}
