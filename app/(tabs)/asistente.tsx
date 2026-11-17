import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useChat } from '@ai-sdk/react';
import type { FileUIPart, UIMessage } from 'ai';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { Burbuja } from '@/components/chat/Burbuja';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Banner } from '@/components/ui/Banner';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { colors, radius, spacing, type } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useConversacion } from '@/hooks/useConversacion';
import { leerPerfil } from '@/hooks/usePerfil';
import { useIsOnline } from '@/lib/queryClient';
import { interpretarErrorIA } from '@/services/ai/errors';
import { crearTransporte } from '@/services/ai/transport';
import { fotoComoDataUrl } from '@/services/vision';

const SUGERENCIAS = [
  '¿Qué foto puedo tomar hoy al atardecer?',
  'Dame 3 ideas para fotografiar de noche',
  '¿Cómo uso GeoCam sin conexión?',
];

async function elegirFoto(origen: 'camara' | 'galeria'): Promise<FileUIPart | null> {
  const permiso =
    origen === 'camara'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) throw new Error('Sin permiso no se puede adjuntar la foto.');

  const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const resultado =
    origen === 'camara'
      ? await ImagePicker.launchCameraAsync(opciones)
      : await ImagePicker.launchImageLibraryAsync(opciones);
  if (resultado.canceled) return null;

  return {
    type: 'file',
    mediaType: 'image/jpeg',
    filename: 'foto.jpg',
    url: await fotoComoDataUrl(resultado.assets[0].uri),
  };
}

function Chat({
  conversationId,
  inicial,
  userId,
  onNueva,
  onGuardar,
}: {
  conversationId: string;
  inicial: UIMessage[];
  userId: string;
  onNueva: () => void;
  onGuardar: (messages: UIMessage[]) => Promise<unknown>;
}) {
  const { signOut } = useAuth();
  const isOnline = useIsOnline();
  const transport = useMemo(() => crearTransporte(() => leerPerfil(userId)), [userId]);
  const { messages, sendMessage, status, error, stop, clearError, regenerate } = useChat({
    id: conversationId,
    messages: inicial,
    transport,
    // C1: al terminar cada respuesta (también si falló o se detuvo) se guarda todo
    onFinish: ({ messages: todos }) => {
      onGuardar(todos).catch(() => {});
    },
  });

  const [texto, setTexto] = useState('');
  const [foto, setFoto] = useState<FileUIPart | null>(null);
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const lista = useRef<FlatList<UIMessage>>(null);

  const ocupado = status === 'submitted' || status === 'streaming';
  const fallo = useMemo(() => (error ? interpretarErrorIA(error, isOnline) : null), [error, isOnline]);
  const puedeEnviar = isOnline && !ocupado && !preparandoFoto && (!!texto.trim() || !!foto);

  // C4: si el token venció, se cierra la sesión para que la persona vuelva a entrar
  useEffect(() => {
    if (fallo?.tipo === 'sesion') signOut();
  }, [fallo?.tipo, signOut]);

  const enviar = (mensaje?: string) => {
    const contenido = (mensaje ?? texto).trim();
    if (!isOnline || ocupado || (!contenido && !foto)) return;
    clearError();
    sendMessage({ text: contenido || '¿Qué ves en esta foto?', files: foto ? [foto] : undefined });
    setTexto('');
    setFoto(null);
  };

  const adjuntar = async (origen: 'camara' | 'galeria') => {
    setPreparandoFoto(true);
    try {
      const elegida = await elegirFoto(origen);
      if (elegida) setFoto(elegida);
    } catch (e) {
      Alert.alert('Foto', (e as Error).message);
    } finally {
      setPreparandoFoto(false);
    }
  };

  const ultimo = messages[messages.length - 1];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolbar}
        style={styles.toolbarWrap}
      >
        <Chip label="Nueva conversación" icon="add" onPress={onNueva} />
        <Chip
          label="Tarjetas de repaso"
          icon="albums-outline"
          onPress={() => router.push({ pathname: '/tarjetas', params: { conversacion: conversationId } })}
        />
        <Chip label="Perfil" icon="person-outline" onPress={() => router.push('/perfil')} />
      </ScrollView>

      {!isOnline ? (
        <Banner icon="cloud-offline-outline" text="Sin conexión. Puedes leer la conversación, pero no enviar." />
      ) : null}

      <FlatList
        ref={lista}
        data={messages}
        keyExtractor={(message) => message.id}
        renderItem={({ item }) => (
          <Burbuja
            mensaje={item}
            escribiendo={status === 'streaming' && item.id === ultimo?.id && item.role === 'assistant'}
          />
        )}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => lista.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <EmptyState
              icon="sparkles-outline"
              title="Pregúntale al asistente"
              detail="Responde sobre fotografía, tus lugares y la app. También entiende fotos."
            />
            <View style={styles.suggestions}>
              {SUGERENCIAS.map((sugerencia) => (
                <AnimatedPressable
                  key={sugerencia}
                  accessibilityRole="button"
                  disabled={!isOnline}
                  haptic
                  onPress={() => enviar(sugerencia)}
                  style={[styles.suggestion, !isOnline && styles.disabled]}
                >
                  <Text style={styles.suggestionText}>{sugerencia}</Text>
                </AnimatedPressable>
              ))}
            </View>
          </View>
        }
        ListFooterComponent={
          status === 'submitted' ? (
            <Animated.View entering={FadeIn} style={styles.thinking}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.thinkingText}>Pensando…</Text>
            </Animated.View>
          ) : undefined
        }
      />

      {fallo && fallo.tipo !== 'sesion' ? (
        <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut} style={styles.errorBox}>
          <Ionicons
            name={fallo.tipo === 'limite' ? 'hourglass-outline' : 'alert-circle-outline'}
            size={18}
            color={fallo.tipo === 'limite' || fallo.tipo === 'cuota' ? colors.warning : colors.danger}
          />
          <Text style={styles.errorText}>{fallo.mensaje}</Text>
          {fallo.reintentable && isOnline ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                clearError();
                regenerate();
              }}
            >
              <Text style={styles.errorAction}>Reintentar</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityLabel="Cerrar aviso" hitSlop={8} onPress={clearError}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </Animated.View>
      ) : null}

      {foto ? (
        <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut} style={styles.preview}>
          <Image source={{ uri: foto.url }} style={styles.previewImage} contentFit="cover" />
          <Text style={styles.previewText}>Foto lista. Se enviará a Google Gemini.</Text>
          <Pressable accessibilityLabel="Quitar foto" hitSlop={8} onPress={() => setFoto(null)}>
            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
          </Pressable>
        </Animated.View>
      ) : null}

      <View style={styles.composer}>
        <AnimatedPressable
          accessibilityLabel="Tomar foto"
          disabled={ocupado || preparandoFoto}
          onPress={() => adjuntar('camara')}
          style={styles.iconButton}
        >
          <Ionicons name="camera-outline" size={22} color={colors.textMuted} />
        </AnimatedPressable>
        <AnimatedPressable
          accessibilityLabel="Elegir foto de la galería"
          disabled={ocupado || preparandoFoto}
          onPress={() => adjuntar('galeria')}
          style={styles.iconButton}
        >
          {preparandoFoto ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Ionicons name="image-outline" size={22} color={colors.textMuted} />
          )}
        </AnimatedPressable>
        <TextInput
          style={styles.input}
          placeholder={isOnline ? 'Escribe tu pregunta' : 'Sin conexión'}
          placeholderTextColor={colors.textFaint}
          value={texto}
          onChangeText={setTexto}
          multiline
          editable={!ocupado}
        />
        {ocupado ? (
          <AnimatedPressable accessibilityLabel="Detener respuesta" haptic onPress={stop} style={styles.send}>
            <Ionicons name="stop" size={18} color={colors.onPrimary} />
          </AnimatedPressable>
        ) : (
          <AnimatedPressable
            accessibilityLabel="Enviar"
            disabled={!puedeEnviar}
            haptic
            onPress={() => enviar()}
            style={[styles.send, !puedeEnviar && styles.disabled]}
          >
            <Ionicons name="arrow-up" size={20} color={colors.onPrimary} />
          </AnimatedPressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

export default function AsistenteScreen() {
  const { isGuest, userId } = useAuth();
  const conversacion = useConversacion(userId);

  if (isGuest) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="sparkles-outline"
          title="Asistente con IA"
          detail="Inicia sesión para conversar con el asistente. Tu llave de IA nunca está en la app."
          action="Iniciar sesión"
          onAction={() => router.push('/auth')}
        />
      </View>
    );
  }

  if (conversacion.cargando || !conversacion.conversationId) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Chat
      key={conversacion.conversationId}
      conversationId={conversacion.conversationId}
      inicial={conversacion.inicial}
      userId={userId}
      onNueva={conversacion.nueva}
      onGuardar={conversacion.guardar}
    />
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  toolbarWrap: { flexGrow: 0 },
  toolbar: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  list: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.sm },
  empty: { flex: 1, gap: spacing.md },
  suggestions: { gap: spacing.sm, paddingHorizontal: spacing.md },
  suggestion: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  suggestionText: { ...type.body, color: colors.text },
  thinking: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm },
  thinkingText: { ...type.caption, color: colors.textMuted },
  errorBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
  },
  errorText: { ...type.label, color: colors.text, flex: 1 },
  errorAction: { ...type.label, color: colors.primary },
  preview: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  previewImage: { borderRadius: radius.sm, height: 48, width: 48 },
  previewText: { ...type.caption, color: colors.textMuted, flex: 1 },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  iconButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 38 },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  send: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  disabled: { opacity: 0.4 },
});
