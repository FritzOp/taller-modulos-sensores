import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
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
} from 'react-native-reanimated';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { colors, radius, spacing, type, type IconName } from '@/constants/theme';
import { useAlbums } from '@/hooks/useAlbums';
import { usePhoto } from '@/hooks/usePhoto';
import { deleteWarning } from '@/hooks/usePhotos';
import { isPending } from '@/services/syncRules';

function MetaRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={17} color={colors.textFaint} />
      <View style={styles.metaTexts}>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function FotoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { photo, isLoading, update, remove } = usePhoto(Number(id));
  const { albums } = useAlbums();

  // null = sin cambios: se muestra la nota guardada, y la sincronización la puede actualizar.
  // Con texto, lo que el usuario está escribiendo no se pisa.
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const noteText = noteDraft ?? photo?.note ?? '';
  const noteChanged = noteDraft !== null && noteDraft.trim() !== (photo?.note ?? '');

  const starScale = useSharedValue(1);
  const starStyle = useAnimatedStyle(() => ({ transform: [{ scale: starScale.get() }] }));

  const toggleFavorite = async () => {
    if (!photo) return;
    starScale.set(withSequence(
      withTiming(1.35, { duration: 110 }),
      withSpring(1, { damping: 9, stiffness: 220 })
    ));
    await update({ favorite: !photo.favorite });
  };

  const handleSaveNote = async () => {
    if (!photo) return;
    setSavingNote(true);
    try {
      await update({ note: noteText.trim() || null });
      setNoteDraft(null);
    } catch (e: any) {
      Alert.alert('No se pudo guardar la nota', e.message ?? 'Inténtalo de nuevo.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDelete = () => {
    if (!photo) return;
    Alert.alert(
      'Eliminar foto',
      deleteWarning(photo.userId === 'local_guest'),
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await remove();
            router.back();
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // No existe, o se borró en otro teléfono mientras esta pantalla estaba abierta
  if (!photo) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="trash-outline"
          title="Esta foto ya no está disponible"
          detail="Se eliminó, quizá desde otro teléfono."
          action="Volver"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const isGuestPhoto = photo.userId === 'local_guest';
  const pending = !isGuestPhoto && isPending(photo);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeIn.duration(260)} style={styles.hero}>
        <Image source={{ uri: photo.uri }} style={styles.heroImage} contentFit="contain" transition={200} />
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={photo.favorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
          accessibilityState={{ selected: photo.favorite }}
          haptic
          scaleTo={0.9}
          onPress={toggleFavorite}
          style={styles.favorite}
        >
          <Animated.View style={starStyle}>
            <Ionicons
              name={photo.favorite ? 'star' : 'star-outline'}
              size={22}
              color={photo.favorite ? colors.favorite : colors.white}
            />
          </Animated.View>
        </AnimatedPressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(280)} style={styles.section}>
        <Text style={styles.sectionTitle}>Nota</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="Escribe una nota para esta foto..."
          placeholderTextColor={colors.textFaint}
          value={noteText}
          onChangeText={setNoteDraft}
          multiline
          textAlignVertical="top"
        />
        {noteChanged ? (
          <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(120)}>
            <Button
              label={savingNote ? 'Guardando...' : 'Guardar nota'}
              icon="checkmark"
              loading={savingNote}
              onPress={handleSaveNote}
            />
          </Animated.View>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(110).duration(280)} style={styles.section}>
        <Text style={styles.sectionTitle}>Álbum</Text>
        <View style={styles.albums}>
          <Chip label="Sin álbum" active={photo.albumId === null} onPress={() => update({ albumId: null })} />
          {albums.map((album) => (
            <Chip
              key={album.id}
              label={album.name}
              icon="folder-outline"
              active={photo.albumId === album.id}
              onPress={() => update({ albumId: album.id })}
            />
          ))}
        </View>
        {!isGuestPhoto ? (
          <Text style={styles.hint}>Los álbumes se guardan solo en este teléfono.</Text>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(160).duration(280)} style={styles.section}>
        <Text style={styles.sectionTitle}>Detalles</Text>
        <MetaRow
          icon={photo.source === 'camera' ? 'camera-outline' : 'images-outline'}
          label="Origen"
          value={photo.source === 'camera' ? 'Cámara' : 'Galería'}
        />
        <MetaRow
          icon="calendar-outline"
          label="Fecha"
          value={new Date(photo.createdAt).toLocaleString('es-CO', {
            dateStyle: 'long',
            timeStyle: 'short',
          })}
        />
        <MetaRow
          icon="location-outline"
          label="Ubicación"
          value={
            photo.latitude !== null && photo.longitude !== null
              ? `${photo.latitude.toFixed(5)}, ${photo.longitude.toFixed(5)} (±${Math.round(photo.accuracy ?? 0)} m)`
              : 'Sin geolocalización'
          }
        />
        <MetaRow
          icon={isGuestPhoto ? 'phone-portrait-outline' : pending ? 'cloud-upload-outline' : 'cloud-done-outline'}
          label="Nube"
          value={
            isGuestPhoto
              ? 'Solo en este teléfono'
              : pending
                ? 'Pendiente de subir'
                : 'Sincronizada'
          }
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(210).duration(280)}>
        <Button label="Eliminar foto" icon="trash-outline" variant="danger" onPress={handleDelete} />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  center: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: {
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    width: '100%',
  },
  heroImage: { height: '100%', width: '100%' },
  favorite: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    borderRadius: radius.full,
    height: 46,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    width: 46,
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  sectionTitle: { ...type.label, color: colors.textMuted },
  noteInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 84,
    padding: spacing.md,
  },
  albums: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { ...type.caption, color: colors.textFaint },
  metaRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  metaTexts: { flex: 1, gap: 1 },
  metaLabel: { ...type.caption, color: colors.textFaint },
  metaValue: { ...type.body, color: colors.text },
});
