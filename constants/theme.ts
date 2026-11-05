// Identidad visual de GeoCam: un solo lugar para colores, espacios y tamaños.
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export const colors = {
  background: '#08090b',
  surface: '#131519',
  surfaceRaised: '#1b1e24',
  border: '#272b33',
  borderStrong: '#3a3f4a',

  text: '#f5f6f8',
  textMuted: '#a4a9b4',
  textFaint: '#6c727e',

  primary: '#2dd4a0',
  primaryPressed: '#22b98a',
  primarySoft: 'rgba(45, 212, 160, 0.14)',
  onPrimary: '#04140e',

  warning: '#f5b342',
  warningSoft: 'rgba(245, 179, 66, 0.14)',
  danger: '#f4676b',
  dangerSoft: 'rgba(244, 103, 107, 0.14)',
  info: '#6cb6ff',
  infoSoft: 'rgba(108, 182, 255, 0.14)',
  favorite: '#ffc53d',

  scrim: 'rgba(8, 9, 11, 0.72)',
  scrimLight: 'rgba(8, 9, 11, 0.5)',
  white: '#ffffff',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 18, xl: 24, full: 999 } as const;

export const type = {
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '500' },
} as const;

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Encabezado compartido por todas las pantallas con barra superior. */
export const headerOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 17 },
  headerShadowVisible: false,
};
