import React from 'react';
import { ActivityIndicator, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { colors, radius, spacing, type IconName } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const palette: Record<Variant, { background: string; border: string; text: string }> = {
  primary: { background: colors.primary, border: colors.primary, text: colors.onPrimary },
  secondary: { background: colors.surfaceRaised, border: colors.border, text: colors.text },
  danger: { background: colors.dangerSoft, border: 'transparent', text: colors.danger },
  ghost: { background: 'transparent', border: 'transparent', text: colors.textMuted },
};

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: Props) {
  const { background, border, text } = palette[variant];
  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      haptic
      onPress={onPress}
      style={[
        styles.base,
        { backgroundColor: background, borderColor: border },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={text} />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={text} />
      ) : null}
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  disabled: { opacity: 0.5 },
  label: { fontSize: 15, fontWeight: '700' },
});
