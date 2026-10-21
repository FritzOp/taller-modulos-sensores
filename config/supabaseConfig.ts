/**
 * Configuración de Conexión a Supabase para GeoCam
 * 
 * Lee variables de entorno si están disponibles en .env:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 * 
 * NUNCA coloques credenciales reales aquí hardcodeadas.
 */

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export function isSupabaseConfigured(): boolean {
  return Boolean(
    SUPABASE_URL &&
    !SUPABASE_URL.includes('TU_PROYECTO') &&
    !SUPABASE_URL.includes('placeholder') &&
    SUPABASE_URL.startsWith('https://') &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_ANON_KEY.includes('TU_SUPABASE_ANON_KEY') &&
    !SUPABASE_ANON_KEY.includes('placeholder') &&
    SUPABASE_ANON_KEY.length > 20
  );
}
