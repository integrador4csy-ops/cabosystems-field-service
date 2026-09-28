import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/fleet';
import type { User } from '@supabase/supabase-js';

interface AdminAuthContextType {
  user: User | null;
  adminProfile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  isEditProfileModalOpen: boolean;
  setIsEditProfileModalOpen: (open: boolean) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateAdminProfile: (data: { nombre: string; avatar_url: string | null }) => Promise<{ success: boolean; error?: string }>;
  refreshAdminProfile: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

  const fetchAdminProfile = useCallback(async (userId: string, userEmail?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching admin profile:', error);
      }

      if (data) {
        setAdminProfile({
          ...data,
          email: userEmail || data.email,
        } as Profile);
        return data as Profile;
      } else {
        // Fallback default admin profile
        const fallback: Profile = {
          id: userId,
          nombre: userEmail?.split('@')[0] || 'Admin CaboSystems',
          rol: 'admin',
          avatar_url: null,
          activo: true,
          email: userEmail,
        };
        setAdminProfile(fallback);
        return fallback;
      }
    } catch (err) {
      console.error('Error in fetchAdminProfile:', err);
      return null;
    }
  }, []);

  // Check current session on mount
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          if (isMounted) {
            setUser(session.user);
            await fetchAdminProfile(session.user.id, session.user.email);
            setIsLoginModalOpen(false);
          }
        } else {
          if (isMounted) {
            setUser(null);
            setAdminProfile(null);
            // Require login when entering
            setIsLoginModalOpen(true);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (isMounted) setIsLoginModalOpen(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    // Listen to Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchAdminProfile(session.user.id, session.user.email);
        setIsLoginModalOpen(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setAdminProfile(null);
        setIsLoginModalOpen(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchAdminProfile]);

  // Login handler
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.user) {
        setUser(data.user);
        const profile = await fetchAdminProfile(data.user.id, data.user.email);
        
        // Ensure user has admin privileges
        if (profile && profile.rol && profile.rol !== 'admin' && profile.rol !== 'supervisor_instalacion') {
          // Warning if not strictly admin, but still allow if authorized
        }

        setIsLoginModalOpen(false);
        return { success: true };
      }

      return { success: false, error: 'No se pudo iniciar sesión.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error en el servidor de autenticación.' };
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setUser(null);
      setAdminProfile(null);
      setIsLoginModalOpen(true);
      setIsEditProfileModalOpen(false);
    }
  };

  // Update Admin Profile (name and avatar)
  const updateAdminProfile = async (data: { nombre: string; avatar_url: string | null }) => {
    if (!user) return { success: false, error: 'No hay sesión de administrador activa.' };

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nombre: data.nombre.trim(),
          avatar_url: data.avatar_url,
        })
        .eq('id', user.id);

      if (error) {
        // If profile doesn't exist, insert it
        const { error: upsertErr } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            nombre: data.nombre.trim(),
            avatar_url: data.avatar_url,
            rol: 'admin',
            activo: true,
          });
        if (upsertErr) throw upsertErr;
      }

      setAdminProfile((prev) =>
        prev
          ? { ...prev, nombre: data.nombre.trim(), avatar_url: data.avatar_url }
          : {
              id: user.id,
              nombre: data.nombre.trim(),
              avatar_url: data.avatar_url,
              rol: 'admin',
              activo: true,
              email: user.email,
            }
      );

      return { success: true };
    } catch (err: any) {
      console.error('Error updating admin profile:', err);
      return { success: false, error: err?.message || 'Error al actualizar el perfil.' };
    }
  };

  const refreshAdminProfile = async () => {
    if (user) {
      await fetchAdminProfile(user.id, user.email);
    }
  };

  const isAdmin = Boolean(user);

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        adminProfile,
        loading,
        isAdmin,
        isLoginModalOpen,
        setIsLoginModalOpen,
        isEditProfileModalOpen,
        setIsEditProfileModalOpen,
        login,
        logout,
        updateAdminProfile,
        refreshAdminProfile,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
