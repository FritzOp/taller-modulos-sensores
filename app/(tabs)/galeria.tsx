import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/SearchField';
import { colors, radius, spacing, type } from '@/constants/theme';
import { useAlbums } from '@/hooks/useAlbums';
import { usePhotos } from '@/hooks/usePhotos';
import { isPending } from '@/services/syncRules';

const GUTTER = spacing.md;

export default function GaleriaScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - spacing.lg * 2 - GUTTER) / 2;

  const [search, setSearch] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [albumName, setAlbumName] = useState('');

  const { photos, removePhoto, deleteWarning } = usePhotos({
    search: search.trim() || undefined,
    albumId: selectedAlbumId,
    onlyFavorites,
  });

  const { albums, createAlbum } = useAlbums();

  const closeAlbumDialog = () => {
    setCreatingAlbum(false);
    setAlbumName('');
  };

  const handleCreateAlbum = async () => {
    try {
      await createAlbum(albumName);
      closeAlbumDialog();
    } catch (e: any) {
      Alert.alert('No se pudo crear el álbum', e.message ?? 'Inténtalo de nuevo.');
    }
  };

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

  const hasFilters = !!search || selectedAlbumId !== null || onlyFavorites;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SyncStatusBadge />
        <Text style={styles.count}>
          {photos.length === 1 ? '1 foto' : `${photos.length} fotos`}
        </Text>
      </View>

      <SearchField value={search} onChangeText={setSearch} placeholder="Buscar por nota..." />

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          keyboardShouldPersistTaps="handled"
        >
          <Chip
            label="Favoritas"
            icon={onlyFavorites ? 'star' : 'star-outline'}
            active={onlyFavorites}
            activeColor={colors.favorite}
            onPress={() => setOnlyFavorites((prev) => !prev)}
          />
          <Chip
            label="Todas"
            active={selectedAlbumId === null}
            onPress={() => setSelectedAlbumId(null)}
          />
          {albums.map((album) => (
            <Chip
              key={album.id}
              label={album.name}
              icon="folder-outline"
              active={selectedAlbumId === album.id}
              onPress={() => setSelectedAlbumId(selectedAlbumId === album.id ? null : album.id)}
            />
          ))}
          <Chip label="Álbum" icon="add" onPress={() => setCreatingAlbum(true)} />
        </ScrollView>
      </View>

      <FlatList
        data={photos}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.column}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            icon={hasFilters ? 'search-outline' : 'camera-outline'}
            title={hasFilters ? 'No se encontraron fotos' : 'Todavía no hay fotos'}
            detail={
              hasFilters
                ? 'Prueba cambiando los filtros o la búsqueda.'
                : 'Captura una foto con la cámara para comenzar.'
            }
          />
        }
        renderItem={({ item, index }) => {
          const pending = item.userId !== 'local_guest' && isPending(item);
          const hasLocation = item.latitude !== null;

          return (
            <Animated.View
              entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(260)}
              exiting={FadeOut.duration(160)}
              layout={LinearTransition.springify().damping(18)}
              style={{ width: cardWidth }}
            >
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityHint="Mantén presionado para eliminar"
                scaleTo={0.96}
                style={styles.card}
                onPress={() =>
                  router.push({ pathname: '/foto/[id]', params: { id: String(item.id) } })
                }
                onLongPress={() => confirmDelete(item.id)}
              >
                <Image
                  source={{ uri: item.uri }}
                  style={styles.image}
                  contentFit="cover"
                  transition={180}
                  recyclingKey={String(item.id)}
                />

                <View style={styles.badges}>
                  {!hasLocation ? (
                    <View style={styles.badge}>
                      <Ionicons name="location-outline" size={12} color={colors.warning} />
                    </View>
                  ) : null}
                  {pending ? (
                    <Animated.View entering={ZoomIn} exiting={FadeOut} style={styles.badge}>
                      <Ionicons name="cloud-upload-outline" size={12} color={colors.warning} />
                    </Animated.View>
                  ) : null}
                  {item.favorite ? (
                    <Animated.View entering={ZoomIn.springify()} style={styles.badge}>
                      <Ionicons name="star" size={12} color={colors.favorite} />
                    </Animated.View>
                  ) : null}
                </View>

                <View style={styles.cardBody}>
                  <Text
                    style={[styles.cardTitle, !item.note && styles.cardDate]}
                    numberOfLines={1}
                  >
                    {item.note ||
                      new Date(item.createdAt).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                  </Text>
                  {item.albumName ? (
                    <Text style={styles.cardAlbum} numberOfLines={1}>
                      {item.albumName}
                    </Text>
                  ) : null}
                </View>
              </AnimatedPressable>
            </Animated.View>
          );
        }}
      />

      <Modal
        visible={creatingAlbum}
        transparent
        animationType="fade"
        onRequestClose={closeAlbumDialog}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Pressable
            accessibilityLabel="Cerrar"
            style={StyleSheet.absoluteFill}
            onPress={closeAlbumDialog}
          />
          <Animated.View entering={FadeIn.duration(180)} style={styles.dialog}>
            <Text style={styles.dialogTitle}>Nuevo álbum</Text>
            <TextInput
              autoFocus
              style={styles.dialogInput}
              placeholder="Nombre del álbum"
              placeholderTextColor={colors.textFaint}
              value={albumName}
              onChangeText={setAlbumName}
              onSubmitEditing={handleCreateAlbum}
              returnKeyType="done"
            />
            <View style={styles.dialogActions}>
              <Button
                label="Cancelar"
                variant="secondary"
                onPress={closeAlbumDialog}
                style={styles.dialogButton}
              />
              <Button
                label="Crear"
                disabled={!albumName.trim()}
                onPress={handleCreateAlbum}
                style={styles.dialogButton}
              />
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  count: { ...type.caption, color: colors.textFaint },
  filters: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  list: { flexGrow: 1, gap: GUTTER, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg },
  column: { gap: GUTTER },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: { aspectRatio: 1, backgroundColor: colors.surfaceRaised, width: '100%' },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
    left: spacing.sm,
    position: 'absolute',
    top: spacing.sm,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    borderRadius: radius.full,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  cardBody: { gap: 2, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  cardTitle: { ...type.label, color: colors.text },
  cardDate: { color: colors.textMuted, fontWeight: '500' },
  cardAlbum: { ...type.caption, color: colors.primary },
  modalRoot: {
    backgroundColor: colors.scrim,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  dialogTitle: { ...type.heading, color: colors.text },
  dialogInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    height: 46,
    paddingHorizontal: spacing.md,
  },
  dialogActions: { flexDirection: 'row', gap: spacing.md },
  dialogButton: { flex: 1 },
});
