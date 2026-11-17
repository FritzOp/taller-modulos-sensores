// Transporte de useChat hacia la Edge Function "asistente".
import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/config/supabaseConfig';
import { supabase } from '@/services/supabase';

/**
 * - api: URL pública de la función.
 * - headers: se calculan en cada mensaje, así siempre va el token vigente.
 * - body: el perfil se lee en cada mensaje (C2); el servidor lo valida.
 * - fetch: el de Expo, que sí entrega la respuesta por partes (streaming).
 */
export function crearTransporte(leerPerfil: () => Promise<object>) {
  return new DefaultChatTransport({
    api: `${SUPABASE_URL}/functions/v1/asistente`,
    fetch: expoFetch as unknown as typeof globalThis.fetch,
    headers: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('No hay sesión: vuelve a iniciar sesión.');
      return { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY };
    },
    body: async () => ({ perfil: await leerPerfil() }),
  });
}
