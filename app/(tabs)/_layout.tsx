import React, { useCallback, useEffect, useState } from 'react';
import { Alert, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, headerOptions, type IconName } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { deleteWarning, usePhotos } from '@/hooks/usePhotos';
import { useShake } from '@/hooks/useShake';
import { useSyncEngine } from '@/hooks/useSync';

function TabIcon({ name, color, focused }: { name: IconName; color: ColorValue; focused: boolean }) {
  const scale = useSharedValue(focused ? 1.12 : 1);

  useEffect(() => {
    scale.set(withSpring(focused ? 1.12 : 1, { damping: 12, stiffness: 240 }));
  }, [focused, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name={name} size={23} color={color as string} />
    </Animated.View>
  );
}

function tabIcon(active: IconName, inactive: IconName) {
  return function Icon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <TabIcon name={focused ? active : inactive} color={color} focused={focused} />;
  };
}

export default function TabLayout() {
  // Mantiene activa la sincronización automática en todas las pestañas
  useSyncEngine();

  // El sensor vive aquí para que funcione en todas las pestañas sin apilar diálogos.
  // Mientras el diálogo está abierto se pausa, porque borrar llega a todos los teléfonos.
  const { isGuest } = useAuth();
  const { photos, clearAll } = usePhotos();
  const [confirming, setConfirming] = useState(false);
  const photoCount = photos.length;

  const handleShake = useCallback(() => {
    if (photoCount === 0) return;
    setConfirming(true);
    Alert.alert(
      'Borrar todas las fotos',
      deleteWarning(isGuest, photoCount),
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => setConfirming(false) },
        {
          text: 'Borrar todas',
          style: 'destructive',
          onPress: async () => {
            await clearAll();
            setConfirming(false);
          },
        },
      ],
      { cancelable: true, onDismiss: () => setConfirming(false) }
    );
  }, [photoCount, clearAll, isGuest]);

  useShake(handleShake, { enabled: !confirming });

  return (
    <Tabs
      screenOptions={{
        ...headerOptions,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="geocam"
        options={{
          title: 'GeoCam',
          headerShown: false,
          tabBarIcon: tabIcon('camera', 'camera-outline'),
        }}
      />
      <Tabs.Screen
        name="galeria"
        options={{
          title: 'Galería',
          headerTitle: 'Galería',
          tabBarIcon: tabIcon('images', 'images-outline'),
        }}
      />
      <Tabs.Screen
        name="mapa"
        options={{
          title: 'Mapa',
          headerShown: false,
          tabBarIcon: tabIcon('map', 'map-outline'),
        }}
      />
      <Tabs.Screen
        name="nube"
        options={{
          title: 'Nube',
          headerTitle: 'Tu nube',
          tabBarIcon: tabIcon('cloud', 'cloud-outline'),
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
