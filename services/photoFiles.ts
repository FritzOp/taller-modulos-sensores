import { Directory, File, Paths } from 'expo-file-system';

const photosDir = new Directory(Paths.document, 'photos');

export function persistPhoto(cacheUri: string): string {
  try {
    if (!photosDir.exists) {
      photosDir.create();
    }
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

export function deletePhotoFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Silently ignore if file doesn't exist or is not a local filesystem file
  }
}
