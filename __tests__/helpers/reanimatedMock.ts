// Reanimated sin animaciones para las pruebas de pantallas: su módulo real necesita el runtime nativo.
import { View } from 'react-native';

/** FadeIn.delay(10).duration(200).springify()...: cada llamada devuelve el mismo objeto. */
const animationBuilder: any = new Proxy(function () {}, {
  get: () => animationBuilder,
  apply: () => animationBuilder,
});

const passThrough = (value: unknown) => value;

module.exports = {
  __esModule: true,
  default: {
    View,
    createAnimatedComponent: (component: unknown) => component,
  },
  useSharedValue: (initial: unknown) => {
    let current = initial;
    return { get: () => current, set: (next: unknown) => (current = next) };
  },
  useAnimatedStyle: (updater: () => object) => updater(),
  withTiming: passThrough,
  withSpring: passThrough,
  withRepeat: passThrough,
  withSequence: passThrough,
  cancelAnimation: () => {},
  Easing: { linear: passThrough, quad: passThrough, inOut: passThrough },
  FadeIn: animationBuilder,
  FadeInDown: animationBuilder,
  FadeInUp: animationBuilder,
  FadeOut: animationBuilder,
  FadeOutUp: animationBuilder,
  ZoomIn: animationBuilder,
  SlideInDown: animationBuilder,
  LinearTransition: animationBuilder,
};
