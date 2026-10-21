import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { photosRepo } from '@/db/repositories/photos';
import { useAlbums } from '@/hooks/useAlbums';
import { syncManager } from '@/services/syncManager';

export default function FotoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const photoId = Number(id);

  const [photo, setPhoto] = useState<Awaited<ReturnType<typeof photosRepo.findById>> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const { albums } = useAlbums();

  const loadPhoto = useCallback(async () => {
    if (!photoId) return;
    try {
      const data = await photosRepo.findById(photoId);
      if (data) {
        setPhoto(data);
        setNoteText(data.note ?? '');
      } else {
        Alert.alert('Error', 'Foto no encontrada');
        router.back();
      }
    } finally {
      setLoading(false);
    }
  }, [photoId]);

  useEffect(() => {
    loadPhoto();
  }, [loadPhoto]);

  const toggleFavorite = async () => {
    if (!photo) return;
    const newFav = !photo.favorite;
    await photosRepo.update(photo.id, { favorite: newFav });
    setPhoto((prev) => (prev ? { ...prev, favorite: newFav, syncStatus: 'pending' } : null));
    syncManager.syncPendingUploads(photo.userId).catch(() => {});
  };

  const handleSaveNote = async () => {
    if (!photo) return;
    setSavingNote(true);
    try {
      const trimmed = noteText.trim() || null;
      await photosRepo.update(photo.id, { note: trimmed });
      setPhoto((prev) => (prev ? { ...prev, note: trimmed, syncStatus: 'pending' } : null));
      syncManager.syncPendingUploads(photo.userId).catch(() => {});
      Alert.alert('Guardado', 'Nota actualizada con éxito');
    } finally {
      setSavingNote(false);
    }
  };

  const handleSetAlbum = async (albumId: number | null) => {
    if (!photo) return;
    await photosRepo.update(photo.id, { albumId });
    const selected = albums.find((a) => a.id === albumId);
    setPhoto((prev) =>
      prev
        ? {
            ...prev,
            albumId,
            albumName: selected ? selected.name : null,
            syncStatus: 'pending',
          }
        : null
    );
    syncManager.syncPendingUploads(photo.userId).catch(() => {});
  };

  const handleDelete = () => {
    if (!photo) return;
    Alert.alert(
      'Eliminar Foto',
      '¿Estás seguro de que deseas eliminar permanentemente esta foto y su archivo local?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await photosRepo.remove(photo.id, photo.userId);
            syncManager.syncPendingDeletions(photo.userId).catch(() => {});
            router.back();
          },
        },
      ]
    );
  };

  if (loading || !photo) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Photo Preview */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="contain" />
        <Pressable
          onPress={toggleFavorite}
          style={[styles.favFloatingBtn, photo.favorite && styles.favFloatingBtnActive]}
          accessibilityLabel="Marcar como favorita"
        >
          <Text style={styles.favFloatingBtnText}>
            {photo.favorite ? '★ Favorita' : '☆ Marcar Favorita'}
          </Text>
        </Pressable>
      </View>

      {/* Metadata Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalles de captura</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Origen:</Text>
          <Text style={styles.metaValue}>
            {photo.source === 'camera' ? '📷 Cámara' : '🖼️ Galería'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Fecha:</Text>
          <Text style={styles.metaValue}>
            {new Date(photo.createdAt).toLocaleString('es-CO')}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Ubicación:</Text>
          <Text style={styles.metaValue}>
            {photo.latitude !== null && photo.longitude !== null
              ? `${photo.latitude.toFixed(5)}, ${photo.longitude.toFixed(5)} (±${Math.round(photo.accuracy ?? 0)}m)`
              : '⚠️ Sin geolocalización'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Estado en la Nube:</Text>
          <Text style={styles.metaValue}>
            {photo.syncStatus === 'synced'
              ? '☁️ Respaldo al día'
              : photo.syncStatus === 'uploading'
              ? '🔄 Subiendo a Supabase...'
              : photo.syncStatus === 'error'
              ? '❌ Error al subir'
              : '⏳ Pendiente de subida'}
          </Text>
        </View>
        {photo.lastSyncedAt && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Último respaldo:</Text>
            <Text style={styles.metaValue}>
              {new Date(photo.lastSyncedAt).toLocaleString('es-CO')}
            </Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Partición de datos:</Text>
          <Text style={styles.metaValue}>
            {photo.userId === 'local_guest' ? '👤 Invitado local' : '🔐 Cuenta Supabase'}
          </Text>
        </View>
      </View>

      {/* Note Editor Section (CRUD Update) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nota descriptiva</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="Escribe una nota para esta foto..."
          placeholderTextColor="#71717a"
          value={noteText}
          onChangeText={setNoteText}
          multiline
          numberOfLines={3}
        />
        <Pressable
          onPress={handleSaveNote}
          disabled={savingNote}
          style={styles.saveBtn}
        >
          <Text style={styles.saveBtnText}>
            {savingNote ? 'Guardando...' : 'Guardar nota'}
          </Text>
        </Pressable>
      </View>

      {/* Move / Assign Album Section (Relationship) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Álbum asignado</Text>
        <View style={styles.albumsContainer}>
          <Pressable
            onPress={() => handleSetAlbum(null)}
            style={[styles.albumChip, photo.albumId === null && styles.albumChipActive]}
          >
            <Text
              style={[
                styles.albumChipText,
                photo.albumId === null && styles.albumChipTextActive,
              ]}
            >
              Sin álbum
            </Text>
          </Pressable>
          {albums.map((album) => (
            <Pressable
              key={album.id}
              onPress={() => handleSetAlbum(album.id)}
              style={[styles.albumChip, photo.albumId === album.id && styles.albumChipActive]}
            >
              <Text
                style={[
                  styles.albumChipText,
                  photo.albumId === album.id && styles.albumChipTextActive,
                ]}
              >
                📁 {album.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Delete Photo Button (CRUD Delete with permanent file removal) */}
      <View style={styles.dangerSection}>
        <Pressable onPress={handleDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>🗑️ Eliminar foto permanentemente</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 340,
    backgroundColor: '#000',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  favFloatingBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(24, 24, 27, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  favFloatingBtnActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  favFloatingBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  section: {
    backgroundColor: '#18181b',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    gap: 8,
  },
  sectionTitle: {
    color: '#f4f4f5',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  metaLabel: {
    color: '#a1a1aa',
    fontSize: 13,
  },
  metaValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  noteInput: {
    backgroundColor: '#09090b',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#3f3f46',
    textAlignVertical: 'top',
    fontSize: 14,
    minHeight: 70,
  },
  saveBtn: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    color: '#09090b',
    fontWeight: '700',
    fontSize: 14,
  },
  albumsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  albumChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  albumChipActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  albumChipText: {
    color: '#d4d4d8',
    fontSize: 12,
    fontWeight: '600',
  },
  albumChipTextActive: {
    color: '#09090b',
    fontWeight: '700',
  },
  dangerSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  deleteBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
