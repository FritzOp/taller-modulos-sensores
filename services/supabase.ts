import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '@/config/supabaseConfig';

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key-placeholder-32chars',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// El token solo se refresca mientras la app está en primer plano: al volver, se renueva
// antes de que la IA o la sincronización lo necesiten.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export { isSupabaseConfigured };
