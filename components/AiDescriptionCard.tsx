import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { colors, radius, spacing, type } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useIsOnline } from '@/lib/queryClient';
import type { ErrorIA } from '@/services/ai/errors';
import { FalloIA } from '@/services/ai/functions';
import { interpretarErrorIA } from '@/services/ai/errors';
import { describirFoto } from '@/services/vision';

interface Props {
  photo: { id: number; uri: string; aiDescription: string | null };
  onSave: (descripcion: string | null) => Promise<unknown>;
}

/** Taller "GeoCam ve": describe la foto con IA. La descripción es una sugerencia editable. */
export function AiDescriptionCard({ photo, onSave }: Props) {
  const { isGuest, signOut } = useAuth();
  const isOnline = useIsOnline();

  // null = sin cambios: se muestra la descripción guardada
  const [draft, setDraft] = useState<string | null>(null);
  const [esSugerencia, setEsSugerencia] = useState(false);
  const [describiendo, setDescribiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<ErrorIA | null>(null);

  const guardada = photo.aiDescription ?? '';
  const texto = draft ?? guardada;
  const cambio = draft !== null && draft.trim() !== guardada;
  const puedeDescribir = !isGuest && isOnline && !describiendo;

  const describir = async () => {
    setFallo(null);
    setDescribiendo(true);
    try {
      const descripcion = await describirFoto(photo.uri);
      setDraft(descripcion);
      setEsSugerencia(true);
    } catch (error) {
      const detalle = error instanceof FalloIA ? error.detalle : interpretarErrorIA(error, isOnline);
      setFallo(detalle);
      if (detalle.tipo === 'sesion') await signOut();
    } finally {
      setDescribiendo(false);
    }
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await onSave(texto.trim() || null);
      setDraft(null);
      setEsSugerencia(false);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Animated.View layout={LinearTransition.duration(200)} style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={16} color={colors.primary} />
        <Text style={styles.title}>Descripción con IA</Text>
      </View>

      {isGuest ? (
        <Text style={styles.hint}>Inicia sesión para describir tus fotos con IA.</Text>
      ) : !isOnline ? (
        <Banner icon="cloud-offline-outline" text="Sin conexión. Describir con IA necesita internet." />
      ) : null}

      {fallo ? (
        <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(120)}>
          <Banner
            icon={fallo.tipo === 'limite' ? 'hourglass-outline' : 'alert-circle-outline'}
            tone={fallo.tipo === 'limite' || fallo.tipo === 'cuota' ? 'warning' : 'danger'}
            text={fallo.mensaje}
            onPress={fallo.tipo === 'sesion' ? () => router.push('/auth') : undefined}
          />
        </Animated.View>
      ) : null}

      {describiendo ? (
        <Animated.View entering={FadeIn.duration(150)} style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.hint}>Analizando la foto…</Text>
        </Animated.View>
      ) : null}

      {texto || draft !== null ? (
        <View style={styles.editor}>
          {esSugerencia ? (
            <Text style={styles.suggestion}>Sugerencia de la IA: revísala y edítala antes de guardar.</Text>
          ) : null}
          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={(value) => setDraft(value)}
            placeholder="Descripción de la foto"
            placeholderTextColor={colors.textFaint}
            multiline
            textAlignVertical="top"
          />
          {cambio ? (
            <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOut.duration(120)}>
              <Button label="Guardar descripción" icon="checkmark" loading={guardando} onPress={guardar} />
            </Animated.View>
          ) : null}
        </View>
      ) : null}

      <Button
        label={guardada || draft ? 'Volver a describir' : 'Describir con IA'}
        icon="sparkles-outline"
        variant={guardada || draft ? 'secondary' : 'primary'}
        disabled={!puedeDescribir}
        loading={describiendo}
        onPress={describir}
      />

      <View style={styles.privacy}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.textFaint} />
        <Text style={styles.privacyText}>
          La foto se envía a Google Gemini para describirla. Su ubicación no se envía. La IA puede
          equivocarse.
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  title: { ...type.label, color: colors.textMuted },
  hint: { ...type.caption, color: colors.textMuted },
  loading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  editor: { gap: spacing.sm },
  suggestion: { ...type.caption, color: colors.primary },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 84,
    padding: spacing.md,
  },
  privacy: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.xs + 2 },
  privacyText: { ...type.caption, color: colors.textFaint, flex: 1 },
});
