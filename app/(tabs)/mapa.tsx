import React, { useEffect, useMemo, useRef } from 'react';
import { Alert, Image as NativeImage, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, LinearTransition, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { colors, radius, spacing, type } from '@/constants/theme';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { usePhotos } from '@/hooks/usePhotos';

const openPhoto = (id: number) =>
  router.push({ pathname: '/foto/[id]', params: { id: String(id) } });

export default function MapaScreen() {
  const { photos, removePhoto, deleteWarning } = usePhotos();
  const geo = useGeoLocation({ watch: true });
  const insets = useSafeAreaInsets();

  // Separate photos with coordinates vs without coordinates (R3)
  const { geoPhotos, unlocatedPhotos } = useMemo(() => {
    const geoList = photos.filter((p) => p.latitude !== null && p.longitude !== null);
    const unlocatedList = photos.filter((p) => p.latitude === null || p.longitude === null);
    return { geoPhotos: geoList, unlocatedPhotos: unlocatedList };
  }, [photos]);

  // Center on current location, or latest geotagged photo, or fallback
  const initialRegion = useMemo(() => {
    if (geo.coords) {
      return {
        latitude: geo.coords.latitude,
        longitude: geo.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    if (geoPhotos.length > 0 && geoPhotos[0].latitude !== null && geoPhotos[0].longitude !== null) {
      return {
        latitude: geoPhotos[0].latitude,
        longitude: geoPhotos[0].longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    // Default fallback coordinates (Bogotá, Colombia)
    return {
      latitude: 4.60971,
      longitude: -74.08175,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [geo.coords, geoPhotos]);

  // initialRegion solo aplica al montar, y esta pestaña sigue montada. Cuando llega una foto,
  // también desde otro teléfono, el mapa va hacia ella para que su pin no quede fuera de vista.
  const mapRef = useRef<MapView>(null);
  const newestPhoto = geoPhotos[0];
  const newestLatitude = newestPhoto?.latitude ?? null;
  const newestLongitude = newestPhoto?.longitude ?? null;
  const userLatitude = geo.coords?.latitude ?? null;
  const userLongitude = geo.coords?.longitude ?? null;
  const hasPhotos = newestLatitude !== null && newestLongitude !== null;

  useEffect(() => {
    if (newestLatitude === null || newestLongitude === null) return;
    mapRef.current?.animateToRegion(
      {
        latitude: newestLatitude,
        longitude: newestLongitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      500
    );
  }, [newestLatitude, newestLongitude]);

  // Sin fotos con ubicación, el mapa va a donde está el usuario apenas se conoce su posición
  const locationKnown = userLatitude !== null && userLongitude !== null;
  useEffect(() => {
    if (hasPhotos || !locationKnown) return;
    mapRef.current?.animateToRegion(
      {
        latitude: userLatitude,
        longitude: userLongitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      500
    );
    // Solo la primera vez que se conoce: no debe perseguir al usuario mientras mira el mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPhotos, locationKnown]);

  const confirmDelete = (id: number) => {
    Alert.alert(
      'Eliminar foto',
      deleteWarning,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => removePhoto(id) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={geo.permission === 'granted'}
        showsMyLocationButton={geo.permission === 'granted'}
        userInterfaceStyle="dark"
        // Mantiene los controles nativos del mapa fuera de la barra de estado
        mapPadding={{ top: insets.top + spacing.sm, right: 0, bottom: 0, left: 0 }}
      >
        {geoPhotos.map((photo) => {
          if (photo.latitude === null || photo.longitude === null) return null;
          return (
            <Marker
              key={photo.id}
              coordinate={{ latitude: photo.latitude, longitude: photo.longitude }}
              pinColor={colors.primary}
              title={photo.source === 'camera' ? 'Foto de cámara' : 'Foto de galería'}
              description={new Date(photo.createdAt).toLocaleString('es-CO')}
            >
              <Callout tooltip onPress={() => openPhoto(photo.id)}>
                <View style={styles.callout}>
                  {/* Dentro de un Callout de Android solo se dibuja la imagen nativa */}
                  <NativeImage source={{ uri: photo.uri }} style={styles.calloutImage} />
                  <View style={styles.calloutBody}>
                    <Text style={styles.calloutTitle} numberOfLines={1}>
                      {photo.note || (photo.source === 'camera' ? 'Foto de cámara' : 'Foto de galería')}
                    </Text>
                    <Text style={styles.calloutMeta}>
                      {photo.latitude.toFixed(4)}, {photo.longitude.toFixed(4)}
                    </Text>
                    <Text style={styles.calloutLink}>Ver detalle</Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      <Animated.View
        entering={FadeInDown.duration(300)}
        layout={LinearTransition.duration(180)}
        style={[styles.summary, { top: insets.top + spacing.sm }]}
      >
        <Ionicons name="location" size={14} color={colors.primary} />
        <Text style={styles.summaryText}>{geoPhotos.length} en el mapa</Text>
        {unlocatedPhotos.length > 0 ? (
          <>
            <View style={styles.summaryDot} />
            <Text style={styles.summaryMuted}>{unlocatedPhotos.length} sin ubicación</Text>
          </>
        ) : null}
      </Animated.View>

      {/* R3: Unlocated photos drawer */}
      {unlocatedPhotos.length > 0 ? (
        <Animated.View entering={SlideInDown.springify().damping(18)} style={styles.drawer}>
          <View style={styles.drawerHandle} />
          <Text style={styles.drawerTitle}>Sin ubicación</Text>
          <Text style={styles.drawerSubtitle}>Fotos tomadas sin permiso de GPS o importadas</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.drawerScroll}
          >
            {unlocatedPhotos.map((photo, index) => (
              <Animated.View
                key={photo.id}
                entering={FadeInUp.delay(Math.min(index, 6) * 40).duration(240)}
                layout={LinearTransition.springify().damping(18)}
              >
                <AnimatedPressable
                  accessibilityRole="button"
                  scaleTo={0.94}
                  style={styles.drawerCard}
                  onPress={() => openPhoto(photo.id)}
                >
                  <Image source={{ uri: photo.uri }} style={styles.drawerImage} contentFit="cover" />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Eliminar foto"
                    hitSlop={8}
                    onPress={() => confirmDelete(photo.id)}
                    style={styles.drawerDelete}
                  >
                    <Ionicons name="close" size={13} color={colors.white} />
                  </Pressable>
                </AnimatedPressable>
              </Animated.View>
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  map: { flex: 1 },
  summary: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.scrim,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs + 2,
    minHeight: 34,
    paddingHorizontal: spacing.md + 2,
    position: 'absolute',
  },
  summaryText: { ...type.caption, color: colors.text },
  summaryMuted: { ...type.caption, color: colors.textMuted },
  summaryDot: {
    backgroundColor: colors.textFaint,
    borderRadius: radius.full,
    height: 3,
    width: 3,
  },
  callout: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    overflow: 'hidden',
    width: 200,
  },
  calloutImage: { height: 110, width: 200 },
  calloutBody: { gap: 2, padding: spacing.sm + 2 },
  calloutTitle: { ...type.label, color: colors.text },
  calloutMeta: { ...type.caption, color: colors.textMuted },
  calloutLink: { ...type.caption, color: colors.primary, marginTop: 2 },
  drawer: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  drawerHandle: {
    alignSelf: 'center',
    backgroundColor: colors.borderStrong,
    borderRadius: radius.full,
    height: 4,
    marginBottom: spacing.sm,
    width: 36,
  },
  drawerTitle: { ...type.label, color: colors.text },
  drawerSubtitle: { ...type.caption, color: colors.textMuted, marginBottom: spacing.sm },
  drawerScroll: { gap: spacing.sm, paddingVertical: spacing.xs },
  drawerCard: {
    borderRadius: radius.md,
    height: 76,
    overflow: 'hidden',
    width: 76,
  },
  drawerImage: { height: '100%', width: '100%' },
  drawerDelete: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    borderRadius: radius.full,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    top: 4,
    width: 22,
  },
});
