// C2. Opciones del perfil en la app. Deben coincidir con supabase/functions/_shared/perfil.ts,
// que es quien de verdad valida (una prueba compara las dos listas).

export const TEMAS = ['fotografia', 'viajes', 'naturaleza', 'programacion'] as const;
export const NIVELES = ['principiante', 'intermedio', 'avanzado'] as const;

export type Tema = (typeof TEMAS)[number];
export type Nivel = (typeof NIVELES)[number];

export interface Perfil {
  nombre: string;
  tema: Tema;
  nivel: Nivel;
}

export const ETIQUETA_TEMA: Record<Tema, string> = {
  fotografia: 'Fotografía',
  viajes: 'Viajes y lugares',
  naturaleza: 'Naturaleza',
  programacion: 'Programación móvil',
};

export const ETIQUETA_NIVEL: Record<Nivel, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
};

export const PERFIL_POR_DEFECTO: Perfil = { nombre: '', tema: 'fotografia', nivel: 'principiante' };

/** Igual que en el servidor: solo letras, espacios y signos de nombre, hasta 40. */
export const NOMBRE_VALIDO = /^[\p{L} .'-]{0,40}$/u;

export const perfilKey = (userId: string) => `perfil:${userId}`;

/** Lee un perfil guardado sin confiar en su contenido. */
export function leerPerfilGuardado(valor: string | null | undefined): Perfil {
  if (!valor) return PERFIL_POR_DEFECTO;
  try {
    const datos = JSON.parse(valor) as Partial<Perfil>;
    return {
      nombre: typeof datos.nombre === 'string' && NOMBRE_VALIDO.test(datos.nombre) ? datos.nombre : '',
      tema: TEMAS.includes(datos.tema as Tema) ? (datos.tema as Tema) : PERFIL_POR_DEFECTO.tema,
      nivel: NIVELES.includes(datos.nivel as Nivel) ? (datos.nivel as Nivel) : PERFIL_POR_DEFECTO.nivel,
    };
  } catch {
    return PERFIL_POR_DEFECTO;
  }
}
