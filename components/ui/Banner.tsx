import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { colors, radius, spacing, type, type IconName } from '@/constants/theme';

interface Props {
  icon: IconName;
  text: string;
  tone?: 'warning' | 'danger' | 'info';
  onPress?: () => void;
}

const tones = {
  warning: { color: colors.warning, background: colors.warningSoft },
  danger: { color: colors.danger, background: colors.dangerSoft },
  info: { color: colors.info, background: colors.infoSoft },
};

/** Aviso que entra y sale deslizándose, sin tapar el contenido. */
export function Banner({ icon, text, tone = 'warning', onPress }: Props) {
  const { color, background } = tones[tone];

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(160)}
      layout={LinearTransition.duration(200)}
      style={[styles.container, { backgroundColor: background }]}
    >
      <Pressable
        accessibilityRole={onPress ? 'button' : 'alert'}
        disabled={!onPress}
        onPress={onPress}
        style={styles.row}
      >
        <Ionicons name={icon} size={16} color={color} />
        <Text style={[styles.text, { color }]}>{text}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  text: { ...type.label, flex: 1 },
});
