import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { colors } from '@/constants/theme';
import type { PermissionState } from '@/types/geo';

interface Props {
  title: string;
  description: string;
  state: PermissionState;
  onRequest: () => void;
  onOpenSettings: () => void;
}

export function PermissionPrimer({ title, description, state, onRequest, onOpenSettings }: Props) {
  const isBlocked = state === 'blocked';

  return (
    <View style={styles.container}>
      <EmptyState
        icon={isBlocked ? 'lock-closed-outline' : 'camera-outline'}
        tone={isBlocked ? 'warning' : 'neutral'}
        title={title}
        detail={
          isBlocked
            ? 'Desactivaste este permiso. Puedes habilitarlo desde los Ajustes del sistema.'
            : description
        }
      />
      <View style={styles.footer}>
        <Button
          label={isBlocked ? 'Abrir Ajustes' : 'Permitir acceso'}
          icon={isBlocked ? 'settings-outline' : 'checkmark'}
          onPress={isBlocked ? onOpenSettings : onRequest}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  footer: { padding: 24, paddingBottom: 40 },
});
