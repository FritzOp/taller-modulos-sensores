import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/hooks/useSync';

export default function AuthScreen() {
  const { user, isConfigured, signIn, signUp, signOut, continueAsGuest } = useAuth();
  const { isSyncing, pendingCount, syncNow, fetchCloudNow } = useSync();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const handleSubmit = async () => {
    if (!isConfigured) {
      Alert.alert(
        'Supabase no configurado',
        'Por favor configura tus credenciales EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en el archivo .env local.'
      );
      return;
    }

    if (!email.trim() || !password) {
      Alert.alert('Datos incompletos', 'Por favor ingresa tu correo y contraseña.');
      return;
    }

    setActionLoading(true);
    try {
      if (isRegister) {
        const { error } = await signUp(email, password);
        if (error) {
          Alert.alert('Error al registrarse', error.message);
        } else {
          Alert.alert(
            'Cuenta creada',
            'Tu cuenta ha sido creada exitosamente. Ya puedes respaldar tus fotos.'
          );
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          Alert.alert('Error al iniciar sesión', error.message);
        } else {
          Alert.alert('Bienvenido', 'Has iniciado sesión. Tus datos locales están activos.');
        }
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncNow = async () => {
    const res = await syncNow();
    if (res.success) {
      Alert.alert(
        'Sincronización Completa',
        `Subidas: ${res.uploadedCount}\nBorradas: ${res.deletedCount}\nDescargadas de la nube: ${res.downloadedCount}`
      );
    } else {
      Alert.alert('Aviso de Sincronización', res.errors.join('\n'));
    }
  };

  const handleFetchCloud = async () => {
    const count = await fetchCloudNow();
    Alert.alert('Consulta de la Nube', `Se descargaron/actualizaron ${count} fotos desde Supabase.`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Profile / Status Card */}
      <View style={styles.card}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarEmoji}>{user ? '👤' : '📱'}</Text>
        </View>
        <Text style={styles.cardTitle}>
          {user ? user.email : 'Modo Invitado (Solo Local)'}
        </Text>
        <Text style={styles.cardSubtitle}>
          {user
            ? 'Tus fotos y álbumes locales están aislados y sincronizados con tu cuenta de Supabase.'
            : 'Las fotos se guardan en la partición local de invitado. Inicia sesión para respaldar en la nube.'}
        </Text>

        {user ? (
          <Pressable
            style={styles.signOutBtn}
            onPress={async () => {
              await signOut();
              Alert.alert('Sesión cerrada', 'Ahora estás en modo local aislado.');
            }}
          >
            <Text style={styles.signOutBtnText}>Cerrar Sesión</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Cloud Sync Tools (When logged in) */}
      {user ? (
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>☁️ Respaldo Confiable en Supabase</Text>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Cambios pendientes:</Text>
            <Text style={[styles.statusValue, pendingCount > 0 ? styles.pendingAlert : null]}>
              {pendingCount > 0 ? `⚠️ ${pendingCount} pendientes` : '✅ Todo al día'}
            </Text>
          </View>

          <Pressable
            style={[styles.primaryBtn, isSyncing && styles.btnDisabled]}
            disabled={isSyncing}
            onPress={handleSyncNow}
          >
            {isSyncing ? (
              <ActivityIndicator color="#09090b" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>🔄 Sincronizar Pendientes Ahora</Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.secondaryBtn, isSyncing && styles.btnDisabled]}
            disabled={isSyncing}
            onPress={handleFetchCloud}
          >
            <Text style={styles.secondaryBtnText}>📥 Consultar Nube / Restaurar Fotos</Text>
          </Pressable>
        </View>
      ) : (
        /* Login / Register Form (When Guest) */
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>
            {isRegister ? 'Crear Nueva Cuenta' : 'Iniciar Sesión'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Correo electrónico"
            placeholderTextColor="#71717a"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor="#71717a"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            style={[styles.primaryBtn, actionLoading && styles.btnDisabled]}
            disabled={actionLoading}
            onPress={handleSubmit}
          >
            {actionLoading ? (
              <ActivityIndicator color="#09090b" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isRegister ? 'Registrarse y Activar Nube' : 'Iniciar Sesión'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setIsRegister((prev) => !prev)}
            style={styles.toggleAuthBtn}
          >
            <Text style={styles.toggleAuthText}>
              {isRegister
                ? '¿Ya tienes cuenta? Inicia sesión'
                : '¿No tienes cuenta? Regístrate aquí'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              continueAsGuest();
              router.back();
            }}
            style={styles.guestBtn}
          >
            <Text style={styles.guestBtnText}>Continuar como Invitado</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    gap: 12,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#27272a',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarEmoji: {
    fontSize: 32,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardSubtitle: {
    color: '#a1a1aa',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionHeader: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statusLabel: {
    color: '#a1a1aa',
    fontSize: 14,
  },
  statusValue: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 14,
  },
  pendingAlert: {
    color: '#f59e0b',
  },
  input: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#09090b',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    backgroundColor: '#27272a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  signOutBtn: {
    marginTop: 8,
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  toggleAuthBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  toggleAuthText: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '600',
  },
  guestBtn: {
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    marginTop: 6,
    paddingTop: 12,
  },
  guestBtnText: {
    color: '#71717a',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
