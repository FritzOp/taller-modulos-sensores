import { Directory, File, Paths } from 'expo-file-system';

const photosDir = new Directory(Paths.document, 'photos');

function ensureDir() {
  if (!photosDir.exists) {
    photosDir.create();
  }
}

export function persistPhoto(cacheUri: string): string {
  try {
    ensureDir();
    const source = new File(cacheUri);
    const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const destination = new File(photosDir, filename);
    source.copy(destination);
    return destination.uri;
  } catch {
    // If copying fails for any reason (e.g. remote or web uri), return original cacheUri
    return cacheUri;
  }
}

/** Descarga una foto que vino de la nube. El nombre sale del clientId: repetir no duplica archivos. */
export async function downloadPhotoFile(url: string, clientId: string): Promise<string> {
  ensureDir();
  const destination = new File(photosDir, `${clientId}.jpg`);
  if (destination.exists) return destination.uri;
  const file = await File.downloadFileAsync(url, destination);
  return file.uri;
}

/** Bytes del archivo para subirlo al bucket. Falla si el archivo ya no existe en el teléfono. */
export async function readPhotoBytes(uri: string): Promise<ArrayBuffer> {
  const file = new File(uri);
  if (!file.exists) {
    throw new Error('El archivo local de la foto ya no existe');
  }
  return file.arrayBuffer();
}

export function deletePhotoFile(uri: string): void {
  try {
    // Don't try to delete remote HTTP/HTTPS URIs locally
    if (!uri || uri.startsWith('http://') || uri.startsWith('https://')) {
      return;
    }
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Silently ignore if file doesn't exist or is not a local filesystem file
  }
}
