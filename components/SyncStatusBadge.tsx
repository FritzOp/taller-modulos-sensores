import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/hooks/useSync';

export function SyncStatusBadge() {
  const { isGuest } = useAuth();
  const { isSyncing, pendingCount } = useSync();

  return (
    <Pressable
      onPress={() => router.push('/auth' as any)}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel="Estado de respaldo en la nube"
    >
      {isSyncing ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color="#10b981" />
          <Text style={styles.textSyncing}>Sincronizando...</Text>
        </View>
      ) : isGuest ? (
        <View style={styles.row}>
          <Text style={styles.icon}>📱</Text>
          <Text style={styles.textGuest}>Local • Iniciar sesión</Text>
        </View>
      ) : pendingCount > 0 ? (
        <View style={styles.row}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.textPending}>{pendingCount} pendientes</Text>
        </View>
      ) : (
        <View style={styles.row}>
          <Text style={styles.icon}>☁️</Text>
          <Text style={styles.textSynced}>Respaldo al día</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#18181b',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#27272a',
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 12,
  },
  textSyncing: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '600',
  },
  textGuest: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '500',
  },
  textPending: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
  },
  textSynced: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
});
