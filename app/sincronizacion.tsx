import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { colors, radius, spacing, type, type IconName } from '@/constants/theme';
import { useSync } from '@/hooks/useSync';

function Stat({ icon, label, value, delay }: { icon: IconName; label: string; value: number; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(280)} style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

function headline(state: {
  isOnline: boolean;
  isSyncing: boolean;
  hasError: boolean;
  pendingCount: number;
}): { icon: IconName; title: string; color: string; background: string } {
  if (!state.isOnline) {
    return {
      icon: 'cloud-offline-outline',
      title: 'Sin conexión',
      color: colors.warning,
      background: colors.warningSoft,
    };
  }
  if (state.isSyncing) {
    return { icon: 'sync-outline', title: 'Sincronizando…', color: colors.info, background: colors.infoSoft };
  }
  if (state.hasError) {
    return {
      icon: 'alert-circle-outline',
      title: 'Hubo un problema',
      color: colors.danger,
      background: colors.dangerSoft,
    };
  }
  if (state.pendingCount > 0) {
    return {
      icon: 'cloud-upload-outline',
      title: 'Hay cambios por subir',
      color: colors.warning,
      background: colors.warningSoft,
    };
  }
  return {
    icon: 'cloud-done-outline',
    title: 'Todo al día',
    color: colors.primary,
    background: colors.primarySoft,
  };
}

export default function SincronizacionScreen() {
  const { isOnline, isSyncing, pendingCount, lastResult, error, syncNow } = useSync();

  const failures = lastResult?.failures ?? [];
  const lastError = lastResult?.error ?? (failures.length > 0 ? error?.message : null);
  const { icon, title, color, background } = headline({
    isOnline,
    isSyncing,
    hasError: !!error,
    pendingCount,
  });

  const rotation = useSharedValue(0);
  const spinning = isSyncing && isOnline;

  useEffect(() => {
    if (spinning) {
      rotation.set(withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      ));
    } else {
      cancelAnimation(rotation);
      rotation.set(0);
    }
  }, [spinning, rotation]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View entering={FadeInDown.duration(280)} style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: background }]}>
          <Animated.View style={iconStyle}>
            <Ionicons name={icon} size={32} color={color} />
          </Animated.View>
        </View>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroDetail}>
          {pendingCount === 0
            ? 'No hay fotos pendientes'
            : pendingCount === 1
              ? '1 foto pendiente'
              : `${pendingCount} fotos pendientes`}
        </Text>
        <Text style={styles.heroDate}>
          {lastResult
            ? `Última sincronización: ${new Date(lastResult.finishedAt).toLocaleString('es-CO', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}`
            : 'Todavía no se ha sincronizado'}
        </Text>
      </Animated.View>

      {!isOnline ? (
        <View style={styles.bannerWrap}>
          <Banner
            icon="information-circle-outline"
            text="Los cambios quedan guardados aquí y se suben solos cuando vuelva la red."
          />
        </View>
      ) : null}

      <View>
        <Text style={styles.sectionTitle}>Último resultado</Text>
        <View style={styles.stats}>
          <Stat icon="cloud-download-outline" label="Bajaron" value={lastResult?.pulled ?? 0} delay={60} />
          <Stat icon="cloud-upload-outline" label="Subieron" value={lastResult?.pushed ?? 0} delay={110} />
          <Stat icon="trash-outline" label="Borradas" value={lastResult?.purged ?? 0} delay={160} />
        </View>
      </View>

      {lastError || failures.length > 0 ? (
        <Animated.View
          entering={FadeInDown.duration(240)}
          exiting={FadeOut.duration(160)}
          layout={LinearTransition.duration(200)}
          style={styles.errorCard}
        >
          <View style={styles.errorHeader}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorTitle}>Último error</Text>
          </View>
          {lastError ? <Text style={styles.errorText}>{lastError}</Text> : null}
          {failures.map((failure) => (
            <Text key={failure.clientId} style={styles.errorText}>
              Foto {failure.clientId.slice(0, 8)}: {failure.message}
            </Text>
          ))}
          <Text style={styles.hint}>Estas fotos siguen pendientes y se reintentan solas.</Text>
        </Animated.View>
      ) : null}

      <Button
        label={isSyncing ? 'Sincronizando…' : 'Sincronizar ahora'}
        icon="sync-outline"
        loading={isSyncing}
        disabled={!isOnline}
        onPress={() => syncNow()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.xs + 2, paddingTop: spacing.lg },
  heroIcon: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 76,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    width: 76,
  },
  heroTitle: { ...type.title, color: colors.text },
  heroDetail: { ...type.body, color: colors.textMuted },
  heroDate: { ...type.caption, color: colors.textFaint, marginTop: 2 },
  bannerWrap: { marginHorizontal: -spacing.lg },
  sectionTitle: { ...type.label, color: colors.textMuted, marginBottom: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  statValue: { ...type.title, color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { ...type.caption, color: colors.textMuted },
  errorCard: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  errorHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  errorTitle: { ...type.label, color: colors.danger },
  errorText: { ...type.caption, color: colors.text, lineHeight: 18 },
  hint: { ...type.caption, color: colors.textMuted },
});
