import React from 'react';
import { Alert, ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraLevelIndicator } from '@/components/CameraLevelIndicator';
import { PermissionPrimer } from '@/components/PermissionPrimer';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { colors, radius, spacing, type, type IconName } from '@/constants/theme';
import { useCamera } from '@/hooks/useCamera';
import { useCameraLevel } from '@/hooks/useCameraLevel';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { usePhotos } from '@/hooks/usePhotos';

function RoundButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      haptic
      scaleTo={0.88}
      onPress={onPress}
      style={styles.roundButton}
    >
      <Ionicons name={icon} size={23} color={colors.white} />
    </AnimatedPressable>
  );
}

export default function GeoCamScreen() {
  const {
    cameraRef,
    permissionState,
    requestPermission,
    openSettings,
    facing,
    toggleFacing,
    onCameraReady,
    takePhoto,
    isCapturing,
  } = useCamera();
  const geo = useGeoLocation({ watch: true });
  const level = useCameraLevel();
  const { photos, addPhoto } = usePhotos();
  const insets = useSafeAreaInsets();

  const shutterScale = useSharedValue(1);
  const flashOpacity = useSharedValue(0);

  const shutterStyle = useAnimatedStyle(() => ({ transform: [{ scale: shutterScale.get() }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.get() }));

  const lastPhoto = photos[0] ?? null;

  if (permissionState === 'checking') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (permissionState !== 'granted') {
    return (
      <PermissionPrimer
        title="GeoCam necesita tu cámara"
        description="La usamos solo para tomar fotos que tú decidas guardar."
        state={permissionState}
        onRequest={requestPermission}
        onOpenSettings={openSettings}
      />
    );
  }

  const handleCapture = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    shutterScale.set(withSequence(
      withTiming(0.82, { duration: 80 }),
      withSpring(1, { damping: 10, stiffness: 240 })
    ));
    flashOpacity.set(withSequence(
      withTiming(0.85, { duration: 50 }),
      withTiming(0, { duration: 240 })
    ));

    const photo = await takePhoto();
    if (!photo) return;

    // Graceful degradation: without location permission, coords stays null
    const coords =
      geo.permission === 'granted' ? (geo.coords ?? (await geo.getCurrent())) : null;

    try {
      await addPhoto({ uri: photo.uri, coords, source: 'camera' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      Alert.alert('No se pudo guardar la foto', e.message ?? 'Inténtalo de nuevo.');
    }
  };

  const handleImportGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const coords =
        geo.permission === 'granted' ? (geo.coords ?? (await geo.getCurrent())) : null;

      await addPhoto({ uri: asset.uri, coords, source: 'gallery' });
    }
  };

  return (
    <View style={styles.container}>
      {/* CameraView without children: controls rendered as absolute siblings */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        onCameraReady={onCameraReady}
      />

      {/* Destello al capturar */}
      <Animated.View pointerEvents="none" style={[styles.flash, flashStyle]} />

      {/* Reto Opcional: Indicador de nivel artificial para nivelar la cámara */}
      <CameraLevelIndicator
        angle={level.angle}
        isLevel={level.isLevel}
        isAvailable={level.isAvailable}
      />

      <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
        <Animated.View entering={FadeInDown.duration(280)}>
          <SyncStatusBadge />
        </Animated.View>

        {/* Live coordinates display */}
        {geo.coords ? (
          <Animated.View entering={FadeIn.duration(280)} exiting={FadeOut} style={styles.coords}>
            <Ionicons name="location" size={13} color={colors.primary} />
            <Text style={styles.coordsText}>
              {geo.coords.latitude.toFixed(5)}, {geo.coords.longitude.toFixed(5)}
            </Text>
            <Text style={styles.accuracyText}>±{Math.round(geo.coords.accuracy ?? 0)} m</Text>
          </Animated.View>
        ) : null}

        {/* Location banner: request in context without blocking camera */}
        {geo.permission !== 'granted' && geo.permission !== 'checking' ? (
          <Animated.View entering={FadeInDown.duration(280)} exiting={FadeOut}>
            <Pressable
              accessibilityRole="button"
              onPress={geo.permission === 'blocked' ? geo.openSettings : geo.requestPermission}
              style={styles.locationBanner}
            >
              <Ionicons name="location-outline" size={15} color={colors.warning} />
              <Text style={styles.locationBannerText}>
                {geo.permission === 'blocked'
                  ? 'Ubicación bloqueada: toca para abrir Ajustes'
                  : 'Activa la ubicación para etiquetar tus fotos'}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>

      {/* Bottom controls row */}
      <View style={styles.bottomControls}>
        <View style={styles.sideSlot}>
          {lastPhoto ? (
            <Animated.View key={lastPhoto.id} entering={ZoomIn.springify().damping(13)}>
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityLabel="Ver la última foto"
                scaleTo={0.9}
                style={styles.thumbnailWrapper}
                onPress={() =>
                  router.push({ pathname: '/foto/[id]', params: { id: String(lastPhoto.id) } })
                }
              >
                <Image source={{ uri: lastPhoto.uri }} style={styles.thumbnail} contentFit="cover" />
              </AnimatedPressable>
            </Animated.View>
          ) : (
            <View style={styles.thumbnailPlaceholder} />
          )}
        </View>

        {/* Capture button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tomar foto"
          disabled={isCapturing}
          onPress={handleCapture}
        >
          <View style={styles.captureRing}>
            <Animated.View
              style={[styles.captureInner, isCapturing && styles.captureInnerBusy, shutterStyle]}
            />
          </View>
        </Pressable>

        <View style={[styles.sideSlot, styles.sideActions]}>
          <RoundButton icon="images-outline" label="Importar de galería" onPress={handleImportGallery} />
          <RoundButton icon="camera-reverse-outline" label="Cambiar cámara" onPress={toggleFacing} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#000', flex: 1 },
  centerContainer: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  flash: { ...StyleSheet.absoluteFill, backgroundColor: colors.white },
  topBar: {
    alignItems: 'flex-start',
    gap: spacing.sm,
    left: spacing.lg,
    position: 'absolute',
    right: spacing.lg,
  },
  coords: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    borderRadius: radius.full,
    flexDirection: 'row',
    gap: spacing.xs + 2,
    minHeight: 28,
    paddingHorizontal: spacing.md,
  },
  coordsText: { ...type.caption, color: colors.text, fontVariant: ['tabular-nums'] },
  accuracyText: { ...type.caption, color: colors.textMuted },
  locationBanner: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    borderColor: colors.warning,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  locationBannerText: { ...type.caption, color: colors.warning, flexShrink: 1 },
  bottomControls: {
    alignItems: 'center',
    backgroundColor: colors.scrimLight,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    position: 'absolute',
    right: 0,
  },
  sideSlot: { alignItems: 'flex-start', flex: 1 },
  sideActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  roundButton: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    borderRadius: radius.full,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  captureRing: {
    alignItems: 'center',
    borderColor: colors.white,
    borderRadius: radius.full,
    borderWidth: 4,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  captureInner: {
    backgroundColor: colors.white,
    borderRadius: radius.full,
    height: 62,
    width: 62,
  },
  captureInnerBusy: { backgroundColor: colors.primary },
  thumbnailWrapper: {
    borderColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 2,
    height: 50,
    overflow: 'hidden',
    width: 50,
  },
  thumbnail: { height: '100%', width: '100%' },
  thumbnailPlaceholder: {
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 50,
    width: 50,
  },
});
