import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import type { PermissionState } from '@/types/geo';

export function useCamera() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const permissionState: PermissionState = !permission
    ? 'checking'
    : permission.granted
    ? 'granted'
    : !permission.canAskAgain
    ? 'blocked'
    : permission.status === 'undetermined'
    ? 'undetermined'
    : 'denied';

  const toggleFacing = useCallback(() => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }, []);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || !isReady || isCapturing) return null;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      return photo ?? null;
    } finally {
      setIsCapturing(false);
    }
  }, [isReady, isCapturing]);

  return {
    cameraRef,
    permissionState,
    requestPermission,
    openSettings: () => Linking.openSettings(),
    facing,
    toggleFacing,
    onCameraReady: () => setIsReady(true),
    takePhoto,
    isCapturing,
  };
}
