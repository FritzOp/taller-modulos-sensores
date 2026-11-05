import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  cancelAnimation,
  Easing,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { colors, radius, spacing, type, type IconName } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/hooks/useSync';

const pendingLabel = (count: number) => (count === 1 ? '1 pendiente' : `${count} pendientes`);

function describe(state: {
  isGuest: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  hasError: boolean;
  pendingCount: number;
}): { icon: IconName; label: string; color: string } {
  const { isGuest, isOnline, isSyncing, hasError, pendingCount } = state;

  if (isGuest) return { icon: 'person-circle-outline', label: 'Solo local · Iniciar sesión', color: colors.textMuted };
  if (!isOnline) {
    return {
      icon: 'cloud-offline-outline',
      label: pendingCount > 0 ? `Sin conexión · ${pendingLabel(pendingCount)}` : 'Sin conexión',
      color: colors.warning,
    };
  }
  if (isSyncing) return { icon: 'sync-outline', label: 'Sincronizando…', color: colors.info };
  if (hasError) return { icon: 'alert-circle-outline', label: 'Error al sincronizar', color: colors.danger };
  if (pendingCount > 0) {
    return { icon: 'cloud-upload-outline', label: pendingLabel(pendingCount), color: colors.warning };
  }
  return { icon: 'cloud-done-outline', label: 'Al día', color: colors.primary };
}

/** Indicador de estado: sin conexión, N pendientes, sincronizando, error o al día. */
export function SyncStatusBadge() {
  const { isGuest } = useAuth();
  const { isOnline, isSyncing, pendingCount, error } = useSync();
  const { icon, label, color } = describe({
    isGuest,
    isOnline,
    isSyncing,
    hasError: !!error,
    pendingCount,
  });

  const spinning = isSyncing && isOnline && !isGuest;
  const rotation = useSharedValue(0);

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
    <Animated.View layout={LinearTransition.duration(200)}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={`Estado de sincronización: ${label}`}
        haptic
        onPress={() => router.push(isGuest ? '/auth' : '/sincronizacion')}
        style={styles.container}
      >
        <Animated.View style={iconStyle}>
          <Ionicons name={icon} size={15} color={color} />
        </Animated.View>
        <Text style={[styles.label, { color }]}>{label}</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs + 2,
    minHeight: 32,
    paddingHorizontal: spacing.md,
  },
  label: type.caption,
});
