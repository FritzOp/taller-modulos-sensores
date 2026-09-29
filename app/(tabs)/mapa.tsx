import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { useShake } from '@/hooks/useShake';

const { width } = Dimensions.get('window');

export default function MapaScreen() {
  const { photos, removePhoto, clearAll } = useGeoPhotos();
  const geo = useGeoLocation({ watch: true });

  // R4: Shake sensor clears photos on this screen as well
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

  // Separate photos with coordinates vs without coordinates (R3)
  const { geoPhotos, unlocatedPhotos } = useMemo(() => {
    const geoList = photos.filter((p) => p.coords !== null);
    const unlocatedList = photos.filter((p) => p.coords === null);
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
    if (geoPhotos.length > 0 && geoPhotos[0].coords) {
      return {
        latitude: geoPhotos[0].coords.latitude,
        longitude: geoPhotos[0].coords.longitude,
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

  return (
    <View style={styles.container}>
      {/* Interactive Map */}
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={geo.permission === 'granted'}
        showsMyLocationButton={geo.permission === 'granted'}
      >
        {geoPhotos.map((photo) => {
          if (!photo.coords) return null;
          return (
            <Marker
              key={photo.id}
              coordinate={{
                latitude: photo.coords.latitude,
                longitude: photo.coords.longitude,
              }}
              title={photo.source === 'camera' ? '📷 Foto de Cámara' : '🖼️ Foto de Galería'}
              description={new Date(photo.createdAt).toLocaleString()}
            >
              <Callout tooltip>
                <View style={styles.calloutContainer}>
                  <Image source={{ uri: photo.uri }} style={styles.calloutImage} />
                  <View style={styles.calloutContent}>
                    <Text style={styles.calloutTitle}>
                      {photo.source === 'camera' ? 'Foto de Cámara' : 'Foto de Galería'}
                    </Text>
                    <Text style={styles.calloutSubtitle}>
                      {photo.coords.latitude.toFixed(4)}, {photo.coords.longitude.toFixed(4)}
                    </Text>
                    <Text style={styles.calloutDate}>
                      {new Date(photo.createdAt).toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Floating Info Header */}
      <View style={styles.floatingHeader}>
        <Text style={styles.floatingHeaderText}>
          📍 {geoPhotos.length} en el mapa • ⚠️ {unlocatedPhotos.length} sin ubicación
        </Text>
      </View>

      {/* R3: Unlocated photos drawer */}
      {unlocatedPhotos.length > 0 && (
        <View style={styles.unlocatedDrawer}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>Sin ubicación ({unlocatedPhotos.length})</Text>
            <Text style={styles.drawerSubtitle}>Fotos tomadas sin permiso GPS o importadas sin EXIF</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.drawerScroll}
          >
            {unlocatedPhotos.map((photo) => (
              <View key={photo.id} style={styles.unlocatedCard}>
                <Image source={{ uri: photo.uri }} style={styles.unlocatedImage} />
                <View style={styles.unlocatedMeta}>
                  <Text style={styles.unlocatedSource}>
                    {photo.source === 'camera' ? '📷 Cámara' : '🖼️ Galería'}
                  </Text>
                  <Pressable
                    onPress={() => removePhoto(photo.id)}
                    style={styles.deleteButton}
                    accessibilityLabel="Eliminar foto"
                  >
                    <Text style={styles.deleteButtonText}>✕</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  map: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  floatingHeader: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(10, 10, 10, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  floatingHeaderText: {
    color: '#f5f5f5',
    fontSize: 13,
    fontWeight: '600',
  },
  calloutContainer: {
    backgroundColor: '#171717',
    borderRadius: 12,
    padding: 8,
    width: 200,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#404040',
  },
  calloutImage: {
    width: 184,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#262626',
  },
  calloutContent: {
    marginTop: 6,
    width: '100%',
  },
  calloutTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  calloutSubtitle: {
    color: '#34d399',
    fontSize: 11,
    fontFamily: 'SpaceMono',
    marginTop: 2,
  },
  calloutDate: {
    color: '#a3a3a3',
    fontSize: 10,
    marginTop: 2,
  },
  unlocatedDrawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  drawerHeader: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  drawerTitle: {
    color: '#f9fafb',
    fontWeight: '700',
    fontSize: 14,
  },
  drawerSubtitle: {
    color: '#9ca3af',
    fontSize: 11,
  },
  drawerScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  unlocatedCard: {
    width: 90,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  unlocatedImage: {
    width: 90,
    height: 90,
  },
  unlocatedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 4,
  },
  unlocatedSource: {
    fontSize: 10,
    color: '#d1d5db',
  },
  deleteButton: {
    padding: 2,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
