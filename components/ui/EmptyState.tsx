import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { colors, radius, spacing, type, type IconName } from '@/constants/theme';

interface Props {
  icon: IconName;
  title: string;
  detail?: string;
  tone?: 'neutral' | 'warning' | 'danger';
  action?: string;
  onAction?: () => void;
}

const tones = {
  neutral: { color: colors.primary, background: colors.primarySoft },
  warning: { color: colors.warning, background: colors.warningSoft },
  danger: { color: colors.danger, background: colors.dangerSoft },
};

/** Mensaje de pantalla completa: vacío, error, sin conexión o invitación a iniciar sesión. */
export function EmptyState({ icon, title, detail, tone = 'neutral', action, onAction }: Props) {
  const { color, background } = tones[tone];

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.container}>
      <Animated.View
        entering={ZoomIn.springify().damping(14)}
        style={[styles.iconCircle, { backgroundColor: background }]}
      >
        <Ionicons name={icon} size={30} color={color} />
      </Animated.View>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {action ? <Button label={action} onPress={onAction} style={styles.action} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  texts: { alignItems: 'center', gap: spacing.xs + 2 },
  title: { ...type.heading, color: colors.text, textAlign: 'center' },
  detail: { ...type.body, color: colors.textMuted, lineHeight: 21, textAlign: 'center' },
  action: { alignSelf: 'center', minWidth: 160 },
});
