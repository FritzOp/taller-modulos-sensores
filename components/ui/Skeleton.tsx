import React, { useEffect } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius } from '@/constants/theme';

interface Props {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Bloque que late mientras llega el contenido, con la forma de lo que va a aparecer. */
export function Skeleton({ width = '100%', height = 16, borderRadius = radius.sm, style }: Props) {
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.set(withRepeat(
      withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    ));
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: colors.surfaceRaised }, style, animatedStyle]}
    />
  );
}
