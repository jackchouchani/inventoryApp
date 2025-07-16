import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { User, Session } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react-native';

// Structure des permissions granulaires
interface AppPermissions {
  items: { create: boolean; update: boolean; delete: boolean };
  categories: { create: boolean; update: boolean; delete: boolean };
  containers: { create: boolean; update: boolean; delete: boolean };
  features: { scanner: boolean; locations: boolean; sources: boolean; invoices: boolean; auditLog: boolean; labels: boolean; dashboard: boolean };
  stats: { viewPurchasePrice: boolean };
  settings: { canManageUsers: boolean };
}

// Profil utilisateur complet incluant rôle et permissions
export interface UserProfile {
  id: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR';
  permissions: AppPermissions;
}

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<{ user: User | null; session: Session | null }>;
  updateCurrentUser: (updatedProfile: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (user: User): Promise<UserProfile | null> => {
    try {
      console.log('Récupération du profil pour l\'utilisateur:', user.id);
      console.log('Email de l\'utilisateur:', user.email);
      
      // Test: essayer d'abord de récupérer tous les profils pour voir si RLS fonctionne
      const { data: allProfiles, error: allError } = await supabase
        .from('profiles')
        .select('id, email')
        .limit(1);
        
      console.log('Test récupération tous profils:', allProfiles, allError);
      
      // Essayer d'abord sans .single() pour voir si c'est ça le problème
      const { data: dataArray, error: errorArray } = await supabase
        .from('profiles')
        .select('role, permissions, email')
        .eq('id', user.id);
        
      console.log('Test récupération sans .single():', dataArray, errorArray);
      
      // Test sans la colonne permissions pour voir si c'est elle qui pose problème
      const { data: dataSimple, error: errorSimple } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', user.id)
        .single();
        
      console.log('Test récupération sans permissions:', dataSimple, errorSimple);
      
      // Ensuite essayer la requête spécifique avec .single()
      const { data, error } = await supabase
        .from('profiles')
        .select('role, permissions, email')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Erreur lors de la récupération du profil avec permissions:', error);
        console.log('Code d\'erreur:', error.code);
        console.log('Message d\'erreur:', error.message);
        console.log('Détails de l\'erreur:', error.details);
        console.log('Hint de l\'erreur:', error.hint);
        
        // Fallback: si la requête avec permissions échoue, utiliser les données sans permissions
        if (dataSimple && !errorSimple) {
          console.log('Utilisation du profil sans permissions, ajout des permissions par défaut');
          
          // Permissions par défaut pour un OPERATOR
          const defaultPermissions = {
            items: { create: true, update: true, delete: false },
            categories: { create: true, update: true, delete: false },
            containers: { create: true, update: true, delete: false },
            features: { 
              scanner: true, 
              locations: true, 
              sources: true, 
              invoices: false, 
              auditLog: false, 
              labels: true, 
              dashboard: false 
            },
            stats: { viewPurchasePrice: false },
            settings: { canManageUsers: false }
          };
          
          return {
            id: user.id,
            email: user.email || '',
            role: dataSimple.role || 'OPERATOR',
            permissions: defaultPermissions,
          };
        }
        
        return null;
      }

      if (!data) {
        console.error('Aucune donnée de profil trouvée');
        return null;
      }

      console.log('Profil récupéré avec succès:', data);
      return {
        id: user.id,
        email: user.email || '',
        role: data.role,
        permissions: data.permissions,
      };
    } catch (error) {
      console.error('Erreur de récupération du profil:', error);
      Sentry.captureException(error);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (mounted && session?.user) {
          const profile = await fetchProfile(session.user);
          setSession(session);
          setUser(profile);
        }
      } catch (error) {
        console.error("Erreur d'initialisation de l'auth:", error);
        Sentry.captureException(error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] Auth state change:', event, 'Session:', !!session);
        if (!mounted) return;

        // Éviter le rechargement si l'utilisateur est déjà connecté avec la même session
        if (event === 'SIGNED_IN' && session?.user) {
          if (user && user.id === session.user.id) {
            console.log('[AuthContext] Utilisateur déjà connecté, pas de rechargement');
            return;
          }
          
          // Ne pas mettre isLoading=true pour éviter les reloads dans _layout
          const profile = await fetchProfile(session.user);
          setSession(session);
          setUser(profile);
          console.log('[AuthContext] User logged in with profile:', profile);
        } else if (event === 'SIGNED_OUT') {
          // Ne pas mettre isLoading=true pour éviter les reloads dans _layout
          setUser(null);
          setSession(null);
          console.log('[AuthContext] User logged out');
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Dépendances désactivées temporairement pour éviter les reloads

  const value = {
    user,
    session,
    isAuthenticated: !!user,
    isLoading,
    signIn: async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // onAuthStateChange gérera la mise à jour de l'état
      } finally {
        setIsLoading(false);
      }
    },
    signOut: async () => {
      setIsLoading(true);
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return true;
      } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    signUp: async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Le trigger `handle_new_user` dans Supabase crée le profil.
        // onAuthStateChange gérera la connexion automatique après confirmation.
        return data;
      } finally {
        setIsLoading(false);
      }
    },
    updateCurrentUser: (updatedProfile: UserProfile) => {
      console.log('[AuthContext] Mise à jour du profil utilisateur:', updatedProfile);
      setUser(updatedProfile);
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
