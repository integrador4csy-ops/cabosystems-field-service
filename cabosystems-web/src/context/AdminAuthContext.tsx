import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { SessionProfileRequest } from '../lib/sessionProfileRequest';
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
  const profileRequests = useRef(new SessionProfileRequest<Profile>());
  const authVersion = useRef(0);
  const selectedUserId = useRef<string | null>(null);

  const selectUser = useCallback((next: User | null) => {
    if (selectedUserId.current !== (next?.id ?? null)) setLoading(Boolean(next));
    selectedUserId.current = next?.id ?? null;
    profileRequests.current.select(next?.id ?? null);
    setUser(next);
    setAdminProfile(previous => previous?.id === next?.id ? previous : null);
  }, []);

  const fetchAdminProfile = useCallback(async (userId: string, userEmail?: string) => {
    try {
      return await profileRequests.current.load(userId, async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching admin profile:', error);
      }

      if (data) {
        return {
          ...data,
          email: userEmail || data.email,
        } as Profile;
      } else {
        // A missing database profile must never confer administrator privileges.
        const fallback: Profile = {
          id: userId,
          nombre: userEmail?.split('@')[0] || 'Admin CaboSystems',
          rol: 'aux_instalacion',
          avatar_url: null,
          activo: false,
          email: userEmail,
        };
        return fallback;
      }
      }, setAdminProfile);
    } catch (err) {
      console.error('Error in fetchAdminProfile:', err);
      return null;
    }
  }, []);

  // Check current session on mount
  useEffect(() => {
    let isMounted = true;

    const applySession = async (next: User | null) => {
      const version = ++authVersion.current;
      selectUser(next);
      setIsLoginModalOpen(!next);
      if (next) {
        await fetchAdminProfile(next.id, next.email);
      }
      if (isMounted && authVersion.current === version) setLoading(false);
    };
    const initialVersion = authVersion.current;
    const initAuth = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted && authVersion.current === initialVersion) await applySession(session?.user ?? null);
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (isMounted && authVersion.current === initialVersion) { setIsLoginModalOpen(true); setLoading(false); }
      }
    };

    initAuth();

    // Listen to Supabase auth events
    // Do not await database calls while the auth client holds its event lock.
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const eventVersion = ++authVersion.current;
      selectUser(session?.user ?? null);
      if (!session?.user) { setIsLoginModalOpen(true); setLoading(false); }
      clearTimeout(authTimer);
      authTimer = setTimeout(() => { if (isMounted && authVersion.current === eventVersion) void applySession(session?.user ?? null); }, 0);
    });

    return () => {
      isMounted = false;
      ++authVersion.current;
      clearTimeout(authTimer);
      profileRequests.current.reset();
      subscription.unsubscribe();
    };
  }, [fetchAdminProfile, selectUser]);

  // Login handler
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const version = authVersion.current;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.user) {
        if (version !== authVersion.current && selectedUserId.current !== data.user.id) {
          return { success: false, error: 'La sesión cambió. Intenta de nuevo.' };
        }
        selectUser(data.user);
        const profile = await fetchAdminProfile(data.user.id, data.user.email);
        
        // Ensure user has admin privileges
        if (profile && profile.rol && profile.rol !== 'admin' && profile.rol !== 'supervisor_instalacion') {
          // Warning if not strictly admin, but still allow if authorized
        }

        if (!profile) return { success: false, error: 'La sesión cambió. Intenta de nuevo.' };
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
    ++authVersion.current;
    profileRequests.current.reset();
    selectUser(null);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      selectUser(null);
      setAdminProfile(null);
      setIsLoginModalOpen(true);
      setIsEditProfileModalOpen(false);
    }
  };

  // Update Admin Profile (name and avatar)
  const updateAdminProfile = async (data: { nombre: string; avatar_url: string | null }) => {
    if (!user) return { success: false, error: 'No hay sesión de administrador activa.' };
    const version = authVersion.current;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nombre: data.nombre.trim(),
          avatar_url: data.avatar_url,
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }
      if (version !== authVersion.current) return { success: false, error: 'La sesión cambió. Intenta de nuevo.' };

      setAdminProfile((prev) =>
        prev
          ? { ...prev, nombre: data.nombre.trim(), avatar_url: data.avatar_url }
          : {
              id: user.id,
              nombre: data.nombre.trim(),
              avatar_url: data.avatar_url,
              rol: 'aux_instalacion',
              activo: false,
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

  const isAdmin = Boolean(user && adminProfile?.rol === 'admin' && adminProfile.activo === true);

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
