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

export async function downloadPhotoToPermanent(remoteUrl: string): Promise<string> {
  try {
    if (!photosDir.exists) {
      photosDir.create();
    }
    const filename = `cloud_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const destination = new File(photosDir, filename);
    const downloadedFile = await File.downloadFileAsync(remoteUrl, destination, {
      idempotent: true,
    });
    return downloadedFile.uri;
  } catch {
    // Fallback: return remoteUrl directly so image can still load via network
    return remoteUrl;
  }
}

export function deletePhotoFile(uri: string): void {
  try {
    // Don't try to delete remote HTTP/HTTPS URIs locally
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
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
