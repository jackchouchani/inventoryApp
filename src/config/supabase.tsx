import { createClient, AuthFlowType } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Les variables d\'environnement Supabase ne sont pas définies');
}

// Désactiver console.log SEULEMENT en production ET pas en debug
if (process.env.NODE_ENV === 'production' && !process.env.EXPO_PUBLIC_DEBUG) {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
} else {
  // En développement, limiter les logs pour améliorer les performances
  const originalLog = console.log;
  const originalInfo = console.info;
  
  console.log = (...args) => {
    if (args[0] && !args[0].includes('🔵 Creating Supabase')) {
      originalLog(...args);
    }
  };
  
  console.info = (...args) => {
    if (args[0] && !args[0].includes('realtime')) {
      originalInfo(...args);
    }
  };
}

// Storage personnalisé qui utilise AsyncStorage sur mobile et localStorage sur web
const createPlatformStorage = () => {
  if (Platform.OS === 'web') {
    // Web - utiliser localStorage
    return {
      getItem: async (key: string) => {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem(key);
          }
          return null;
        } catch (e) {
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, value);
          }
        } catch (e) {
          console.error('Erreur lors de la sauvegarde de la session:', e);
        }
      },
      removeItem: async (key: string) => {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(key);
          }
        } catch (e) {
          console.error('Erreur lors de la suppression de la session:', e);
        }
      }
    };
  } else {
    // Mobile - utiliser AsyncStorage
    return {
      getItem: async (key: string) => {
        try {
          return await AsyncStorage.getItem(key);
        } catch (e) {
          console.error('Erreur AsyncStorage getItem:', e);
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          await AsyncStorage.setItem(key, value);
        } catch (e) {
          console.error('Erreur AsyncStorage setItem:', e);
        }
      },
      removeItem: async (key: string) => {
        try {
          await AsyncStorage.removeItem(key);
        } catch (e) {
          console.error('Erreur AsyncStorage removeItem:', e);
        }
      }
    };
  }
};

const platformStorage = createPlatformStorage();

// Configuration pour toutes les plateformes
const supabaseConfig = {
  auth: {
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    storage: platformStorage,
    autoRefreshToken: true,
    flowType: 'pkce' as AuthFlowType,
    debug: false,
    logger: {
      error: () => {},
      warn: () => {},
      info: () => {}
    }
  },
  realtime: {
    // Désactiver complètement realtime sur toutes les plateformes
    // pour éviter les problèmes avec ws sur mobile
    transport: 'polling',
    timeout: 1000,
    heartbeatIntervalMs: 300000, // 5 minutes
    reconnectAfterMs: () => 60000, // 1 minute
    encode: (payload, callback) => {
      // Désactiver complètement - ne pas envoyer de données
      return callback('');
    },
    decode: (payload, callback) => {
      // Désactiver complètement - ne pas décoder
      return callback({});
    }
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  },
};

// Réduire la fréquence des rafraîchissements de token en développement
if (process.env.NODE_ENV === 'development') {
  supabaseConfig.auth.autoRefreshToken = false;
}

// Configuration pour désactiver complètement l'auto-refresh en développement
const devConfig = {
  ...supabaseConfig,
  auth: {
    ...supabaseConfig.auth,
    autoRefreshToken: false,
    // Désactiver les listeners d'événements en développement
    detectSessionInUrl: false,
  }
};

// Instance principale Supabase (singleton global ultra-robuste)
let supabaseInstance: ReturnType<typeof createClient> | null = null;

// Clé unique pour éviter les instances multiples
const INSTANCE_KEY = '__supabase_single_instance__';

// Fonction pour créer le client principal (garantie d'une seule instance)
const getSupabaseInstance = () => {
  // Vérifier d'abord le contexte global (web)
  if (typeof window !== 'undefined' && (window as any)[INSTANCE_KEY]) {
    return (window as any)[INSTANCE_KEY];
  }
  
  // Ensuite vérifier la variable locale
  if (supabaseInstance) {
    return supabaseInstance;
  }
  
  // Créer une nouvelle instance seulement si nécessaire
  const config = process.env.NODE_ENV === 'development' ? devConfig : supabaseConfig;
  supabaseInstance = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    config
  );
  
  // Stocker dans le contexte global pour éviter les duplications
  if (typeof window !== 'undefined') {
    (window as any)[INSTANCE_KEY] = supabaseInstance;
  }
  
  return supabaseInstance;
};

export const supabase = getSupabaseInstance();

// Client admin - utilisation différée pour éviter la création d'instance au chargement
export const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY 
  ? (() => {
      let adminInstance: ReturnType<typeof createClient> | null = null;
      return {
        getInstance: () => {
          if (!adminInstance) {
            adminInstance = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
              auth: {
                autoRefreshToken: false,
                persistSession: false
              }
            });
          }
          return adminInstance;
        },
        // Méthodes déléguées pour éviter la création d'instance immédiate
        auth: {
          admin: {
            inviteUserByEmail: async (email: string, options?: any) => {
              const instance = adminInstance || createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
                auth: { autoRefreshToken: false, persistSession: false }
              });
              if (!adminInstance) adminInstance = instance;
              return await instance.auth.admin.inviteUserByEmail(email, options);
            }
          }
        }
      };
    })()
  : null;

// Test de connexion Supabase pour debug
export const testSupabaseConnection = async () => {
  try {
    // Attendre un peu que la session soit disponible après l'auth
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test de base de la connexion
    const { data: itemsData, error: itemsError } = await supabase.from('items').select('id').limit(1);
    
    if (itemsError) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
};
