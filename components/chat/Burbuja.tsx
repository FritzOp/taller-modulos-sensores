import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { UIMessage } from 'ai';
import { Image } from 'expo-image';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { colors, radius, spacing } from '@/constants/theme';
import { fragmentosMarkdown } from '@/services/ai/markdown';

/** Pinta un mensaje recorriendo sus parts: texto e imágenes. */
export function Burbuja({ mensaje, escribiendo }: { mensaje: UIMessage; escribiendo?: boolean }) {
  const esUsuario = mensaje.role === 'user';

  return (
    <Animated.View
      entering={FadeInUp.duration(200)}
      style={[styles.burbuja, esUsuario ? styles.usuario : styles.asistente]}
    >
      {mensaje.parts.map((part, index) => {
        switch (part.type) {
          case 'text':
            return part.text ? (
              <Text key={index} selectable style={esUsuario ? styles.textoUsuario : styles.texto}>
                {esUsuario
                  ? part.text
                  : fragmentosMarkdown(part.text).map((fragmento, i) =>
                      fragmento.negrita ? (
                        <Text key={i} style={styles.negrita}>
                          {fragmento.texto}
                        </Text>
                      ) : (
                        fragmento.texto
                      )
                    )}
              </Text>
            ) : null;
          case 'file':
            return part.mediaType.startsWith('image') ? (
              <Image key={index} source={{ uri: part.url }} style={styles.foto} contentFit="cover" />
            ) : null;
          default:
            // Razonamiento, pasos y herramientas no se muestran
            return null;
        }
      })}
      {escribiendo ? <Text style={styles.cursor}>▍</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  burbuja: {
    borderRadius: radius.lg,
    gap: spacing.sm,
    marginVertical: spacing.xs,
    maxWidth: '86%',
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  usuario: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: radius.sm,
  },
  asistente: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceRaised,
    borderBottomLeftRadius: radius.sm,
    borderColor: colors.border,
    borderWidth: 1,
  },
  texto: { color: colors.text, fontSize: 15, lineHeight: 22 },
  negrita: { fontWeight: '700' },
  textoUsuario: { color: colors.onPrimary, fontSize: 15, fontWeight: '500', lineHeight: 22 },
  foto: { borderRadius: radius.md, height: 180, width: 220 },
  cursor: { color: colors.primary, fontSize: 15 },
});
