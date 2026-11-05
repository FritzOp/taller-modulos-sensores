import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedBase = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Tamaño mientras se presiona. */
  scaleTo?: number;
  haptic?: boolean;
}

/** Botón que responde al dedo: se encoge con un resorte y da una vibración leve. */
export function AnimatedPressable({
  style,
  scaleTo = 0.96,
  haptic = false,
  onPressIn,
  onPressOut,
  onPress,
  ...props
}: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedBase
      {...props}
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        scale.set(withTiming(scaleTo, { duration: 90 }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, { damping: 14, stiffness: 260 }));
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress?.(event);
      }}
    />
  );
}
