import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { colors, radius, spacing, type } from '@/constants/theme';
import { usePerfil } from '@/hooks/usePerfil';
import {
  ETIQUETA_NIVEL,
  ETIQUETA_TEMA,
  NIVELES,
  NOMBRE_VALIDO,
  TEMAS,
  type Nivel,
  type Tema,
} from '@/services/ai/perfil';

/** C2. Con estos datos el servidor arma las instrucciones del asistente. */
export default function PerfilScreen() {
  const { perfil, guardar } = usePerfil();
  const [nombre, setNombre] = useState<string | null>(null);
  const [tema, setTema] = useState<Tema | null>(null);
  const [nivel, setNivel] = useState<Nivel | null>(null);
  const [guardando, setGuardando] = useState(false);

  const nombreActual = nombre ?? perfil.nombre;
  const nombreValido = NOMBRE_VALIDO.test(nombreActual.trim());

  const onGuardar = async () => {
    setGuardando(true);
    try {
      await guardar({ nombre: nombreActual.trim(), tema: tema ?? perfil.tema, nivel: nivel ?? perfil.nivel });
      router.back();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        El asistente adapta sus respuestas a estos datos. Se guardan en este teléfono y viajan con
        cada mensaje; el servidor los revisa antes de usarlos.
      </Text>

      <View style={styles.section}>
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={[styles.input, !nombreValido && styles.inputError]}
          value={nombreActual}
          onChangeText={setNombre}
          placeholder="Cómo quieres que te llame"
          placeholderTextColor={colors.textFaint}
          maxLength={40}
          autoCapitalize="words"
        />
        {!nombreValido ? <Text style={styles.error}>Usa solo letras y espacios.</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Tema preferido</Text>
        <View style={styles.chips}>
          {TEMAS.map((opcion) => (
            <Chip
              key={opcion}
              label={ETIQUETA_TEMA[opcion]}
              active={(tema ?? perfil.tema) === opcion}
              onPress={() => setTema(opcion)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Nivel</Text>
        <View style={styles.chips}>
          {NIVELES.map((opcion) => (
            <Chip
              key={opcion}
              label={ETIQUETA_NIVEL[opcion]}
              active={(nivel ?? perfil.nivel) === opcion}
              onPress={() => setNivel(opcion)}
            />
          ))}
        </View>
      </View>

      <Button label="Guardar perfil" icon="checkmark" disabled={!nombreValido} loading={guardando} onPress={onGuardar} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { ...type.body, color: colors.textMuted, lineHeight: 21 },
  section: { gap: spacing.sm },
  label: { ...type.label, color: colors.textMuted },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    height: 48,
    paddingHorizontal: spacing.md,
  },
  inputError: { borderColor: colors.danger },
  error: { ...type.caption, color: colors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
