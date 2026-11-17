// C2. El perfil llega desde la app, así que no se confía en él: cada campo se valida y,
// si viene inválido o inventado, se reemplaza por un valor seguro en lugar de fallar.
import { z } from 'npm:zod@4';

export const TEMAS = ['fotografia', 'viajes', 'naturaleza', 'programacion'] as const;
export const NIVELES = ['principiante', 'intermedio', 'avanzado'] as const;

export const NOMBRE_TEMA: Record<(typeof TEMAS)[number], string> = {
  fotografia: 'fotografía',
  viajes: 'viajes y lugares',
  naturaleza: 'naturaleza',
  programacion: 'programación de apps móviles',
};

const NOMBRE_NIVEL: Record<(typeof NIVELES)[number], string> = {
  principiante: 'principiante: explica sin tecnicismos y con ejemplos cotidianos',
  intermedio: 'intermedio: puedes usar términos técnicos básicos',
  avanzado: 'avanzado: ve directo al detalle técnico',
};

export const PERFIL_POR_DEFECTO = { nombre: '', tema: 'fotografia', nivel: 'principiante' } as const;

export const perfilSchema = z
  .object({
    // Solo letras, espacios y signos de nombre: así el nombre no puede traer instrucciones
    nombre: z
      .string()
      .trim()
      .regex(/^[\p{L} .'-]{1,40}$/u)
      .catch(PERFIL_POR_DEFECTO.nombre),
    tema: z.enum(TEMAS).catch(PERFIL_POR_DEFECTO.tema),
    nivel: z.enum(NIVELES).catch(PERFIL_POR_DEFECTO.nivel),
  })
  .catch({ ...PERFIL_POR_DEFECTO });

export type Perfil = z.infer<typeof perfilSchema>;

export function instruccionesAsistente(perfil: Perfil): string {
  const saludo = perfil.nombre ? `La persona se llama ${perfil.nombre}.` : 'No sabes el nombre de la persona.';
  return [
    'Eres el asistente de GeoCam, una app para tomar fotos con su ubicación y guardarlas en un álbum.',
    'Respondes en español, claro y breve: máximo 8 líneas salvo que pidan más detalle.',
    `Tema preferido: ${NOMBRE_TEMA[perfil.tema]}. Nivel: ${NOMBRE_NIVEL[perfil.nivel]}.`,
    saludo,
    'Si te envían una foto, descríbela y relaciónala con la pregunta.',
    'Si no sabes algo, dilo; no inventes datos ni lugares. No pidas ni repitas datos personales.',
    // Agregado tras una prueba real: sin esto recomendó un barrio de una ciudad que nadie mencionó
    'No sabes en qué ciudad está la persona: si pide un sitio, sugiere tipos de lugares o pregúntale la ciudad.',
  ].join('\n');
}
