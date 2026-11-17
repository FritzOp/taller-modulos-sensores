import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { colors, radius, spacing, type } from '@/constants/theme';
import { chatRepo } from '@/db/repositories/chat';
import { useIsOnline } from '@/lib/queryClient';
import type { ErrorIA } from '@/services/ai/errors';
import { interpretarErrorIA } from '@/services/ai/errors';
import { FalloIA, invocarIA } from '@/services/ai/functions';

interface Tarjeta {
  pregunta: string;
  respuesta: string;
}

/** Tarjeta que se voltea para mostrar la respuesta. */
function TarjetaVolteable({ tarjeta, indice }: { tarjeta: Tarjeta; indice: number }) {
  const giro = useSharedValue(0);
  const frente = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(giro.get(), [0, 1], [0, 180])}deg` }],
    opacity: giro.get() < 0.5 ? 1 : 0,
  }));
  const reverso = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(giro.get(), [0, 1], [180, 360])}deg` }],
    opacity: giro.get() >= 0.5 ? 1 : 0,
  }));

  return (
    <Animated.View entering={FadeInDown.delay(indice * 70).duration(260)}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityHint="Toca para ver la respuesta"
        haptic
        scaleTo={0.98}
        onPress={() => giro.set(withTiming(giro.get() < 0.5 ? 1 : 0, { duration: 380 }))}
        style={styles.cardSlot}
      >
        <Animated.View style={[styles.card, frente]}>
          <Text style={styles.cardKicker}>Pregunta {indice + 1}</Text>
          <Text style={styles.cardText}>{tarjeta.pregunta}</Text>
          <Text style={styles.cardHint}>Toca para ver la respuesta</Text>
        </Animated.View>
        <Animated.View style={[styles.card, styles.cardBack, reverso]}>
          <Text style={[styles.cardKicker, { color: colors.onPrimary }]}>Respuesta</Text>
          <Text style={[styles.cardText, { color: colors.onPrimary }]}>{tarjeta.respuesta}</Text>
        </Animated.View>
      </AnimatedPressable>
    </Animated.View>
  );
}

/** C3. Tarjetas de repaso generadas a partir de la conversación (salida estructurada). */
export default function TarjetasScreen() {
  const { conversacion } = useLocalSearchParams<{ conversacion: string }>();
  const isOnline = useIsOnline();

  // Una sola respuesta de IA: es estado de servidor, así que la maneja TanStack Query.
  // Sin reintentos automáticos: cada intento gasta cuota y cuenta para el límite diario.
  const consulta = useQuery({
    queryKey: ['tarjetas', conversacion],
    queryFn: async () => {
      const messages = await chatRepo.messages(conversacion);
      const respuesta = await invocarIA<{ tarjetas: Tarjeta[] }>('tarjetas', { messages });
      return respuesta.tarjetas;
    },
    staleTime: Infinity,
    retry: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const tarjetas = consulta.data ?? null;
  const cargando = consulta.isFetching;
  const fallo: ErrorIA | null = consulta.error
    ? consulta.error instanceof FalloIA
      ? consulta.error.detalle
      : interpretarErrorIA(consulta.error, isOnline)
    : null;
  const generar = () => consulta.refetch();

  if (!isOnline && !tarjetas) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="cloud-offline-outline"
          tone="warning"
          title="Sin conexión"
          detail="Las tarjetas se crean con IA y necesitan internet."
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {cargando ? (
        <View style={styles.list}>
          <View style={styles.header}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.headerText}>Creando tarjetas con IA. Puede tardar unos segundos…</Text>
          </View>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} height={140} borderRadius={radius.lg} />
          ))}
        </View>
      ) : fallo ? (
        <EmptyState
          icon={fallo.tipo === 'limite' ? 'hourglass-outline' : 'alert-circle-outline'}
          tone={fallo.tipo === 'limite' || fallo.tipo === 'invalida' ? 'warning' : 'danger'}
          title={fallo.tipo === 'limite' ? 'Límite alcanzado' : 'No se pudieron crear'}
          detail={fallo.mensaje}
          action={fallo.reintentable ? 'Reintentar' : undefined}
          onAction={generar}
        />
      ) : tarjetas ? (
        <View style={styles.list}>
          <View style={styles.header}>
            <Ionicons name="albums-outline" size={18} color={colors.primary} />
            <Text style={styles.headerText}>{tarjetas.length} tarjetas de tu conversación</Text>
          </View>
          {tarjetas.map((tarjeta, indice) => (
            <TarjetaVolteable key={`${indice}-${tarjeta.pregunta}`} tarjeta={tarjeta} indice={indice} />
          ))}
          <Button
            label="Crear otras"
            icon="refresh"
            variant="secondary"
            disabled={!isOnline}
            onPress={generar}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl },
  list: { gap: spacing.md },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  headerText: { ...type.label, color: colors.textMuted, flexShrink: 1 },
  cardSlot: { minHeight: 150 },
  card: {
    backfaceVisibility: 'hidden',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    minHeight: 150,
    padding: spacing.lg,
  },
  cardBack: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  cardKicker: { ...type.caption, color: colors.primary },
  cardText: { ...type.heading, color: colors.text, lineHeight: 24 },
  cardHint: { ...type.caption, color: colors.textFaint, marginTop: 'auto' },
});
