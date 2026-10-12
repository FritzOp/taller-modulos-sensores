import React from 'react';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Text, Platform } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="geocam"
      screenOptions={{
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#262626',
        },
        headerStyle: {
          backgroundColor: '#0a0a0a',
        },
        headerTintColor: '#ffffff',
      }}
    >
      <Tabs.Screen
        name="geocam"
        options={{
          title: 'GeoCam',
          headerShown: false,
          tabBarIcon: ({ color }) =>
            Platform.OS === 'ios' ? (
              <SymbolView
                name={{
                  ios: 'camera.fill',
                  android: 'camera',
                  web: 'camera',
                }}
                tintColor={color}
                size={24}
              />
            ) : (
              <Text style={{ fontSize: 20 }}>📷</Text>
            ),
        }}
      />
      <Tabs.Screen
        name="galeria"
        options={{
          title: 'Galería',
          headerShown: true,
          headerTitle: 'Galería y Álbumes',
          tabBarIcon: ({ color }) =>
            Platform.OS === 'ios' ? (
              <SymbolView
                name={{
                  ios: 'photo.on.rectangle.angled',
                  android: 'photo_library',
                  web: 'photo_library',
                }}
                tintColor={color}
                size={24}
              />
            ) : (
              <Text style={{ fontSize: 20 }}>🖼️</Text>
            ),
        }}
      />
      <Tabs.Screen
        name="mapa"
        options={{
          title: 'Mapa',
          headerShown: true,
          headerTitle: 'Mapa de Fotos',
          tabBarIcon: ({ color }) =>
            Platform.OS === 'ios' ? (
              <SymbolView
                name={{
                  ios: 'map.fill',
                  android: 'map',
                  web: 'map',
                }}
                tintColor={color}
                size={24}
              />
            ) : (
              <Text style={{ fontSize: 20 }}>🗺️</Text>
            ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
