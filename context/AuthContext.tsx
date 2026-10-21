import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/services/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userId: string;
  isGuest: boolean;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, pass: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    // Read current session from persistent storage
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    // Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signIn = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pass,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    if (isConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
  };

  const continueAsGuest = () => {
    setUser(null);
    setSession(null);
  };

  const userId = user ? user.id : 'local_guest';
  const isGuest = !user;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userId,
        isGuest,
        loading,
        isConfigured,
        signIn,
        signUp,
        signOut,
        continueAsGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
