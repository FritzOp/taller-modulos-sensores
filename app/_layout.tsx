import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '@/drizzle/migrations';
import { db } from '@/db/client';
import { AuthProvider } from '@/context/AuthContext';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const { success: migrationsSuccess, error: migrationsError } = useMigrations(db, migrations);

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
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Iniciando base de datos offline...</Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="foto/[id]"
          options={{
            presentation: 'card',
            headerShown: true,
            title: 'Detalle de Foto',
            headerStyle: { backgroundColor: '#0a0a0a' },
            headerTintColor: '#ffffff',
          }}
        />
        <Stack.Screen
          name="auth"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Respaldo y Cuenta',
            headerStyle: { backgroundColor: '#0a0a0a' },
            headerTintColor: '#ffffff',
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
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorDetail: {
    color: '#d4d4d8',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#a1a1aa',
    fontSize: 14,
  },
});
