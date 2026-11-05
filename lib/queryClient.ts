import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, focusManager, onlineManager, type Query } from '@tanstack/react-query';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // durante 30 s no se repite una consulta que ya está en caché
      gcTime: ONE_DAY_MS, // debe ser al menos maxAge para que la caché persistida no se descarte
      retry: 2,
    },
  },
});

// Caché que sobrevive al cierre: solo el feed de la nube, nunca el estado de la sincronización
export const persistOptions = {
  persister: createAsyncStoragePersister({
    storage: AsyncStorage,
    key: 'geocam-query-cache',
    throttleTime: 1_000,
  }),
  maxAge: ONE_DAY_MS,
  buster: 'semana9-v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      query.queryKey[0] === 'cloud' && query.state.status === 'success',
  },
};

// 1. TanStack Query se entera del estado de la red
onlineManager.setEventListener((setOnline) => {
  let initialised = false;
  const toOnline = (state: Network.NetworkState) =>
    !!state.isConnected && state.isInternetReachable !== false;

  const subscription = Network.addNetworkStateListener((state) => {
    initialised = true;
    setOnline(toOnline(state));
  });
  Network.getNetworkStateAsync()
    .then((state) => {
      if (!initialised) setOnline(toOnline(state));
    })
    .catch(() => {});
  return () => subscription.remove();
});

// 2. TanStack Query se entera de cuándo la app vuelve a primer plano
export function useAppFocusManager() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);
}

// 3. Hook para que la UI muestre si hay conexión
export function useIsOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline()
  );
}
