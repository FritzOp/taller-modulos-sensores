import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import * as Location from 'expo-location';
import type { Coords, PermissionState } from '@/types/geo';

interface Options {
  watch?: boolean;
}

interface GeoLocationState {
  permission: PermissionState;
  coords: Coords | null;
  error: string | null;
}

function mapPermission(res: Location.LocationPermissionResponse): PermissionState {
  if (res.granted) return 'granted';
  if (!res.canAskAgain) return 'blocked';
  if (res.status === 'undetermined') return 'undetermined';
  return 'denied';
}

function toCoords(loc: Location.LocationObject): Coords {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy,
    timestamp: loc.timestamp,
  };
}

export function useGeoLocation({ watch = false }: Options = {}) {
  const [state, setState] = useState<GeoLocationState>({
    permission: 'checking',
    coords: null,
    error: null,
  });

  // 1. On mount: only QUERY the permission, never request it directly
  useEffect(() => {
    let cancelled = false;
    Location.getForegroundPermissionsAsync()
      .then((res) => {
        if (!cancelled) setState((s) => ({ ...s, permission: mapPermission(res) }));
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, permission: 'denied' }));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Request permission via explicit user action
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const res = await Location.requestForegroundPermissionsAsync();
    setState((s) => ({ ...s, permission: mapPermission(res) }));
    return res.granted;
  }, []);

  // 3. Single reading, useful right before capturing photo
  const getCurrent = useCallback(async (): Promise<Coords | null> => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = toCoords(loc);
      setState((s) => ({ ...s, coords, error: null }));
      return coords;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo obtener la ubicacion';
      setState((s) => ({ ...s, error: message }));
      return null;
    }
  }, []);

  // 4. Continuous tracking with safe cleanup against early unmount
  useEffect(() => {
    if (!watch || state.permission !== 'granted') return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (loc) => setState((s) => ({ ...s, coords: toCoords(loc), error: null }))
    )
      .then((sub) => {
        if (cancelled) sub.remove();
        else subscription = sub;
      })
      .catch((e) =>
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : 'Error de GPS' }))
      );

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [watch, state.permission]);

  const openSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  return { ...state, requestPermission, getCurrent, openSettings };
}
