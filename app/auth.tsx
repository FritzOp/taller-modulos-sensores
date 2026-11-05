import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { colors, radius, spacing, type, type IconName } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

function Field({
  icon,
  ...props
}: { icon: IconName } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={18} color={colors.textFaint} />
      <TextInput style={styles.input} placeholderTextColor={colors.textFaint} {...props} />
    </View>
  );
}

const SEGMENT_GAP = 4;

export default function AuthScreen() {
  const { user, isConfigured, signIn, signUp, signOut, continueAsGuest } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [segmentWidth, setSegmentWidth] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [
      {
        translateX: withSpring(isRegister ? segmentWidth : 0, { damping: 18, stiffness: 220 }),
      },
    ],
  }));

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
        const { error, outcome } = await signUp(email, password);
        if (error) {
          Alert.alert('No se pudo crear la cuenta', error);
        } else if (outcome === 'already_registered') {
          setIsRegister(false);
          setPassword('');
          Alert.alert(
            'Este correo ya tiene cuenta',
            'No se creó una cuenta nueva ni cambió la contraseña. Inicia sesión con tu contraseña de siempre o usa otro correo.'
          );
        } else if (outcome === 'confirm_email') {
          setIsRegister(false);
          setPassword('');
          Alert.alert(
            'Confirma tu correo',
            'Te enviamos un enlace. Ábrelo para activar la cuenta y después inicia sesión aquí.'
          );
        } else {
          Alert.alert('Cuenta creada', 'Tus fotos ya se están sincronizando.');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          Alert.alert('No se pudo iniciar sesión', error);
        } else {
          Alert.alert('Bienvenido', 'Has iniciado sesión. Tus fotos ya se están sincronizando.');
        }
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(280)} style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons
              name={user ? 'person' : 'cloud-outline'}
              size={32}
              color={colors.primary}
            />
          </View>
          <Text style={styles.heroTitle}>{user ? user.email : 'Tus fotos, en todos lados'}</Text>
          <Text style={styles.heroDetail}>
            {user
              ? 'Tus fotos se sincronizan solas entre tus teléfonos.'
              : 'Sin cuenta, las fotos se guardan solo en este teléfono. Inicia sesión para respaldarlas en la nube.'}
          </Text>
        </Animated.View>

        {user ? (
          <Animated.View entering={FadeInDown.delay(80).duration(280)} style={styles.actions}>
            <Button
              label="Ver estado de sincronización"
              icon="sync-outline"
              onPress={() => router.push('/sincronizacion')}
            />
            <Button
              label="Cerrar sesión"
              icon="log-out-outline"
              variant="danger"
              onPress={async () => {
                await signOut();
                Alert.alert('Sesión cerrada', 'Ahora estás en modo local.');
              }}
            />
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(80).duration(280)} style={styles.card}>
            <View
              style={styles.segment}
              onLayout={(event) =>
                setSegmentWidth((event.nativeEvent.layout.width - SEGMENT_GAP * 2) / 2)
              }
            >
              <Animated.View style={[styles.segmentIndicator, indicatorStyle]} />
              {[
                { label: 'Iniciar sesión', value: false },
                { label: 'Crear cuenta', value: true },
              ].map(({ label, value }) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isRegister === value }}
                  onPress={() => setIsRegister(value)}
                  style={styles.segmentButton}
                >
                  <Text
                    style={[styles.segmentLabel, isRegister === value && styles.segmentLabelActive]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Animated.View key={String(isRegister)} entering={FadeIn.duration(200)} style={styles.form}>
              <Field
                icon="mail-outline"
                placeholder="Correo electrónico"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
              <Field
                icon="lock-closed-outline"
                placeholder="Contraseña"
                secureTextEntry
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password}
                onChangeText={setPassword}
              />
              <Button
                label={isRegister ? 'Crear cuenta' : 'Iniciar sesión'}
                loading={actionLoading}
                onPress={handleSubmit}
              />
            </Animated.View>

            <Button
              label="Continuar sin cuenta"
              variant="ghost"
              onPress={() => {
                continueAsGuest();
                router.back();
              }}
            />
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    height: 76,
    justifyContent: 'center',
    marginBottom: spacing.xs,
    width: 76,
  },
  heroTitle: { ...type.title, color: colors.text, textAlign: 'center' },
  heroDetail: { ...type.body, color: colors.textMuted, lineHeight: 21, textAlign: 'center' },
  actions: { gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  segment: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    flexDirection: 'row',
    padding: SEGMENT_GAP,
  },
  segmentIndicator: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    bottom: SEGMENT_GAP,
    left: SEGMENT_GAP,
    position: 'absolute',
    top: SEGMENT_GAP,
  },
  segmentButton: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 40 },
  segmentLabel: { ...type.label, color: colors.textFaint },
  segmentLabelActive: { color: colors.text },
  form: { gap: spacing.md },
  field: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.md,
  },
  input: { color: colors.text, flex: 1, fontSize: 15, height: '100%' },
});
