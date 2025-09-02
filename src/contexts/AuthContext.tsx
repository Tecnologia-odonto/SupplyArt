import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types/database';
import { User } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

interface AuthContextData {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: { name: string; role: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  const createAuditLog = async (action: string, userId?: string, details?: any) => {
    try {
      await supabase.from('audit_logs').insert({
        user_id: userId || null,
        action,
        table_name: 'auth',
        record_id: userId || null,
        new_values: details || { action }
      });
    } catch (error) {
      console.error('Error creating audit log:', error);
    }
  };

  // Auto logout após 2 horas de inatividade para operadores administrativos
  useEffect(() => {
    if (!user || !profile || profile.role !== 'operador-administrativo') return;

    const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 horas em ms

    const checkInactivity = () => {
      const now = Date.now();
      if (now - lastActivity > INACTIVITY_TIMEOUT) {
        toast.error('Sessão expirada por inatividade. Faça login novamente.');
        signOut();
      }
    };

    const updateActivity = () => {
      setLastActivity(Date.now());
    };

    // Eventos que indicam atividade do usuário
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    // Verificar inatividade a cada minuto
    const interval = setInterval(checkInactivity, 60000);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
      clearInterval(interval);
    };
  }, [user, profile, lastActivity]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      // Verificar se as variáveis de ambiente estão configuradas
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        console.error('Supabase environment variables not configured');
        toast.error('Configuração do Supabase não encontrada. Verifique as variáveis de ambiente.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      
      // Verificar se é erro de rede
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        toast.error('Erro de conexão. Verifique sua internet e configuração do Supabase.');
      } else {
        toast.error('Erro ao carregar perfil do usuário');
      }
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  };

  const signUp = async (email: string, password: string, userData: { name: string; role: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      // Create or update profile using upsert to handle existing profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          name: userData.name,
          email: email,
          role: userData.role as any,
        });

      if (profileError) throw profileError;

      // Create audit log for user creation
      await createAuditLog('USER_CREATED', data.user.id, {
        email,
        name: userData.name,
        role: userData.role,
        timestamp: new Date().toISOString()
      });
    }
  };

  const signOut = async () => {
    const currentUser = user;
    
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Create audit log for logout
    if (currentUser) {
      await createAuditLog('LOGOUT', currentUser.id, {
        timestamp: new Date().toISOString()
      });
    }
  };

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};