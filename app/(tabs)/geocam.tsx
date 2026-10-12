import React from 'react';
import { View, Text, Pressable, Image, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useCamera } from '@/hooks/useCamera';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { useShake } from '@/hooks/useShake';
import { useCameraLevel } from '@/hooks/useCameraLevel';
import { usePhotos } from '@/hooks/usePhotos';
import { PermissionPrimer } from '@/components/PermissionPrimer';
import { CameraLevelIndicator } from '@/components/CameraLevelIndicator';

export default function GeoCamScreen() {
  const cam = useCamera();
  const geo = useGeoLocation({ watch: true });
  const level = useCameraLevel();
  const { photos, addPhoto, clearAll } = usePhotos();

  // R4: Shake sensor integration to prompt clearing photos
  useShake(() => {
    Alert.alert(
      'Borrar fotos',
      '¿Deseas eliminar todas las fotos guardadas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar todas', style: 'destructive', onPress: clearAll },
      ]
    );
  });

  const lastPhoto = photos[0] ?? null;

  if (cam.permissionState === 'checking') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (cam.permissionState !== 'granted') {
    return (
      <PermissionPrimer
        title="GeoCam necesita tu cámara"
        description="La usamos solo para tomar fotos que tú decidas guardar."
        state={cam.permissionState}
        onRequest={cam.requestPermission}
        onOpenSettings={cam.openSettings}
      />
    );
  }

  const handleCapture = async () => {
    const photo = await cam.takePhoto();
    if (!photo) return;

    // Graceful degradation: without location permission, coords stays null
    const coords =
      geo.permission === 'granted'
        ? (geo.coords ?? (await geo.getCurrent()))
        : null;

    await addPhoto({
      uri: photo.uri,
      coords,
      source: 'camera',
    });
  };

  const handleImportGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const coords =
        geo.permission === 'granted'
          ? (geo.coords ?? (await geo.getCurrent()))
          : null;

      await addPhoto({
        uri: asset.uri,
        coords,
        source: 'gallery',
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* CameraView without children: controls rendered as absolute siblings */}
      <CameraView
        ref={cam.cameraRef}
        style={StyleSheet.absoluteFill}
        facing={cam.facing}
        onCameraReady={cam.onCameraReady}
      />

      {/* Location banner: request in context without blocking camera */}
      {geo.permission !== 'granted' && geo.permission !== 'checking' && (
        <Pressable
          onPress={geo.permission === 'blocked' ? geo.openSettings : geo.requestPermission}
          style={styles.locationBanner}
        >
          <Text style={styles.locationBannerText}>
            {geo.permission === 'blocked'
              ? 'Ubicación bloqueada: Toca para abrir Ajustes'
              : 'Activa la ubicación para etiquetar tus fotos'}
          </Text>
        </Pressable>
      )}

      {/* Live coordinates display */}
      {geo.coords && (
        <View style={styles.coordsBadge}>
          <Text style={styles.coordsText}>
            {geo.coords.latitude.toFixed(5)}, {geo.coords.longitude.toFixed(5)}
          </Text>
          <Text style={styles.accuracyText}>
            ±{Math.round(geo.coords.accuracy ?? 0)} m
          </Text>
        </View>
      )}

      {/* Reto Opcional: Indicador de nivel artificial para nivelar la cámara */}
      <CameraLevelIndicator
        angle={level.angle}
        isLevel={level.isLevel}
        isAvailable={level.isAvailable}
      />

      {/* Bottom controls row */}
      <View style={styles.bottomControls}>
        {/* Gallery button */}
        <Pressable
          onPress={handleImportGallery}
          style={styles.iconButton}
          accessibilityLabel="Importar de galería"
        >
          <Text style={styles.iconText}>🖼️</Text>
        </Pressable>

        {/* Capture button */}
        <Pressable
          onPress={handleCapture}
          disabled={cam.isCapturing}
          style={styles.captureButton}
          accessibilityLabel="Tomar foto"
        >
          <View
            style={[styles.captureInner, cam.isCapturing ? styles.captureInnerCapturing : null]}
          />
        </Pressable>

        {/* Camera switch button */}
        <Pressable
          onPress={cam.toggleFacing}
          style={styles.iconButton}
          accessibilityLabel="Cambiar cámara"
        >
          <Text style={styles.iconText}>🔄</Text>
        </Pressable>

        {/* Thumbnail preview of last photo */}
        {lastPhoto ? (
          <View style={styles.thumbnailWrapper}>
            <Image
              source={{ uri: lastPhoto.uri }}
              style={styles.thumbnail}
            />
            <View style={styles.thumbnailBadge}>
              <Text style={styles.thumbnailBadgeText}>
                {lastPhoto.source === 'camera' ? '📷' : '🖼️'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.thumbnailPlaceholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
  },
  locationBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 56,
    borderRadius: 12,
    backgroundColor: '#fbbf24',
    padding: 12,
    zIndex: 10,
    elevation: 4,
  },
  locationBannerText: {
    textAlign: 'center',
    fontWeight: '600',
    color: '#171717',
    fontSize: 14,
  },
  coordsBadge: {
    position: 'absolute',
    left: 16,
    top: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 10,
  },
  coordsText: {
    fontSize: 12,
    color: '#34d399',
    fontWeight: '600',
  },
  accuracyText: {
    fontSize: 11,
    color: '#a3a3a3',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 16,
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(23, 23, 23, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 22,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
  },
  captureInnerCapturing: {
    backgroundColor: '#9ca3af',
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 52,
    height: 52,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  thumbnailBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#000',
    borderRadius: 8,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  thumbnailBadgeText: {
    fontSize: 10,
  },
  thumbnailPlaceholder: {
    width: 52,
    height: 52,
  },
});
