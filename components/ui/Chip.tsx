import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { colors, radius, spacing, type, type IconName } from '@/constants/theme';

interface Props {
  label: string;
  icon?: IconName;
  active?: boolean;
  activeColor?: string;
  onPress: () => void;
}

export function Chip({ label, icon, active = false, activeColor = colors.primary, onPress }: Props) {
  const color = active ? activeColor : colors.textMuted;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      haptic
      onPress={onPress}
      style={[
        styles.chip,
        active && { backgroundColor: `${activeColor}24`, borderColor: activeColor },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={color} /> : null}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs + 2,
    minHeight: 36,
    paddingHorizontal: spacing.md + 2,
  },
  label: type.label,
});
