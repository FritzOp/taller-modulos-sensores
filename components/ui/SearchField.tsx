import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, radius, spacing } from '@/constants/theme';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}

/** Buscador con borde que se ilumina al enfocarse y botón para limpiar. */
export function SearchField({ value, onChangeText, placeholder }: Props) {
  const [focused, setFocused] = useState(false);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: withTiming(focused ? colors.primary : colors.border, { duration: 160 }),
  }));

  return (
    <Animated.View style={[styles.container, borderStyle]}>
      <Ionicons name="search" size={18} color={focused ? colors.primary : colors.textFaint} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(120)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Limpiar búsqueda"
            hitSlop={10}
            onPress={() => onChangeText('')}
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    height: 46,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  input: { color: colors.text, flex: 1, fontSize: 15, height: '100%' },
});
