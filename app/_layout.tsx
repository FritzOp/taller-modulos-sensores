import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { colors, headerOptions } from '@/constants/theme';
import { AuthProvider } from '@/context/AuthContext';
import { useDatabaseReady } from '@/hooks/useDatabaseReady';
import { persistOptions, queryClient, useAppFocusManager } from '@/lib/queryClient';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  anchor: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const { success: migrationsSuccess, error: migrationsError } = useDatabaseReady();
  useAppFocusManager();

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (loaded && migrationsSuccess) {
      SplashScreen.hideAsync();
    }
  }, [loaded, migrationsSuccess]);

  if (migrationsError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error al migrar la base de datos:</Text>
        <Text style={styles.errorDetail}>{migrationsError.message}</Text>
      </View>
    );
  }

  if (!loaded || !migrationsSuccess) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Iniciando base de datos offline...</Text>
      </View>
    );
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    border: colors.border,
    primary: colors.primary,
    text: colors.text,
  },
};

function RootLayoutNav() {
  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ ...headerOptions, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="foto/[id]"
          options={{
            presentation: 'card',
            headerShown: true,
            title: 'Foto',
          }}
        />
        <Stack.Screen
          name="auth"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Tu cuenta',
          }}
        />
        <Stack.Screen
          name="sincronizacion"
          options={{
            headerShown: true,
            title: 'Sincronización',
          }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorDetail: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
