import { PostgrestError } from '@supabase/supabase-js';
import Toast from 'react-native-toast-message';
import * as Sentry from '@sentry/react-native';

// Types d'erreurs
export const ErrorType = {
  DATABASE: 'DATABASE',
  AUTHENTICATION: 'AUTHENTICATION',
  NETWORK: 'NETWORK',
  SCANNER: 'SCANNER',
  VALIDATION: 'VALIDATION',
  UNKNOWN: 'UNKNOWN',
  CONTAINER_CONTENTS_LOAD_MORE: 'CONTAINER_CONTENTS_LOAD_MORE',
  CONTAINER_CONTENTS_REFRESH: 'CONTAINER_CONTENTS_REFRESH',
  GRID_ERROR: 'GRID_ERROR'
} as const;

export type ErrorTypeEnum = typeof ErrorType[keyof typeof ErrorType];

// Structure pour les messages d'erreur traduits
interface ErrorMessage {
  fr: string;
  en: string;
}

export interface ErrorDetails {
  message: string;
  code?: string;
  type: ErrorTypeEnum;
  originalError?: unknown;
}

// Mapping des codes d'erreur Supabase
const supabaseErrorCodes: Record<string, ErrorMessage> = {
  // Erreurs de base de données PostgreSQL
  '23505': {
    fr: 'Cette entrée existe déjà dans la base de données.',
    en: 'This entry already exists in the database.'
  },
  '23503': {
    fr: 'Cette opération viole une contrainte de clé étrangère.',
    en: 'This operation violates a foreign key constraint.'
  },
  '42P01': {
    fr: 'La table spécifiée n\'existe pas.',
    en: 'The specified table does not exist.'
  },
  '42703': {
    fr: 'La colonne spécifiée n\'existe pas.',
    en: 'The specified column does not exist.'
  },
  // Erreurs d'authentification Supabase
  'PGRST301': {
    fr: 'Erreur d\'authentification.',
    en: 'Authentication error.'
  },
  'PGRST302': {
    fr: 'Session expirée.',
    en: 'Session expired.'
  },
  // Erreurs de requête
  'PGRST100': {
    fr: 'Erreur de syntaxe dans la requête.',
    en: 'Query syntax error.'
  },
  'PGRST200': {
    fr: 'Erreur dans les paramètres de la requête.',
    en: 'Query parameters error.'
  },
  // Erreurs de limite et de pagination
  'PGRST103': {
    fr: 'Limite de requêtes dépassée.',
    en: 'Query limit exceeded.'
  },
  'PGRST104': {
    fr: 'Erreur de pagination.',
    en: 'Pagination error.'
  },
  // Erreurs de stockage
  'storage/object-not-found': {
    fr: 'Le fichier demandé n\'existe pas.',
    en: 'The requested file does not exist.'
  },
  'storage/unauthorized': {
    fr: 'Accès non autorisé au stockage.',
    en: 'Unauthorized storage access.'
  },
  'storage/quota-exceeded': {
    fr: 'Quota de stockage dépassé.',
    en: 'Storage quota exceeded.'
  },
  // Erreurs de réseau
  'network/timeout': {
    fr: 'La requête a expiré.',
    en: 'Request timed out.'
  },
  'network/no-connection': {
    fr: 'Pas de connexion internet.',
    en: 'No internet connection.'
  },
  // Erreurs de validation
  'validation/required': {
    fr: 'Ce champ est requis.',
    en: 'This field is required.'
  },
  'validation/format': {
    fr: 'Format invalide.',
    en: 'Invalid format.'
  },
  'validation/constraint': {
    fr: 'Contrainte non respectée.',
    en: 'Constraint violation.'
  }
};

// Messages d'erreur génériques par type
const genericErrors: Record<ErrorTypeEnum, ErrorMessage> = {
  [ErrorType.DATABASE]: {
    fr: 'Erreur de base de données.',
    en: 'Database error.'
  },
  [ErrorType.AUTHENTICATION]: {
    fr: 'Erreur d\'authentification.',
    en: 'Authentication error.'
  },
  [ErrorType.NETWORK]: {
    fr: 'Erreur de connexion réseau.',
    en: 'Network connection error.'
  },
  [ErrorType.SCANNER]: {
    fr: 'Erreur lors du scan.',
    en: 'Scanner error.'
  },
  [ErrorType.VALIDATION]: {
    fr: 'Erreur de validation des données.',
    en: 'Data validation error.'
  },
  [ErrorType.UNKNOWN]: {
    fr: 'Une erreur inattendue s\'est produite.',
    en: 'An unexpected error occurred.'
  },
  [ErrorType.CONTAINER_CONTENTS_LOAD_MORE]: {
    fr: 'Erreur lors du chargement des éléments supplémentaires.',
    en: 'Error loading more items.'
  },
  [ErrorType.CONTAINER_CONTENTS_REFRESH]: {
    fr: 'Erreur lors du rafraîchissement des éléments.',
    en: 'Error refreshing items.'
  },
  [ErrorType.GRID_ERROR]: {
    fr: 'Erreur dans l\'affichage de la grille.',
    en: 'Grid display error.'
  }
};

// Fonction principale de gestion des erreurs
export const handleError = (error: unknown, type: ErrorTypeEnum): ErrorDetails => {
  console.error(`Error in ${type}:`, error);
  
  Sentry.withScope((scope) => {
    scope.setTag('error_type', type);
    scope.setExtra('error_details', error);
    Sentry.captureException(error);
  });

  let errorMessage: string;
  if (error instanceof Error) {
    if ('code' in error && typeof (error as any).code === 'string') {
      const code = (error as any).code;
      errorMessage = supabaseErrorCodes[code]?.fr || genericErrors[type].fr;
    } else {
      errorMessage = error.message || genericErrors[type].fr;
    }
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else {
    errorMessage = genericErrors[type].fr;
  }

  Toast.show({
    type: 'error',
    text1: 'Erreur',
    text2: errorMessage,
    position: 'bottom',
    visibilityTime: 4000,
    autoHide: true,
  });

  return {
    message: errorMessage,
    type,
    code: error instanceof Error && 'code' in error ? (error as any).code : undefined,
    originalError: error
  };
};

// Fonctions utilitaires spécialisées
export const handleValidationError = (message: string): ErrorDetails => {
  return handleError(new Error(message), ErrorType.VALIDATION);
};

export const handleAuthError = (error: Error): ErrorDetails => {
  return handleError(error, ErrorType.AUTHENTICATION);
};

export const handleDatabaseError = (error: PostgrestError | Error): ErrorDetails => {
  return handleError(error, ErrorType.DATABASE);
};

export const handleScannerError = (error: Error): ErrorDetails => {
  return handleError(error, ErrorType.SCANNER);
};

export const handleNetworkError = (error: Error): ErrorDetails => {
  // Détecter le type d'erreur réseau
  let networkErrorType = 'network/unknown';
  
  if (error.message.includes('timeout')) {
    networkErrorType = 'network/timeout';
  } else if (error.message.includes('offline') || error.message.includes('internet')) {
    networkErrorType = 'network/no-connection';
  }

  return handleError(error, ErrorType.NETWORK);
};

// Fonction utilitaire pour vérifier la connexion réseau
export const checkNetworkConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch('https://www.google.com', { 
      method: 'HEAD',
      mode: 'no-cors'
    });
    return true;
  } catch (error) {
    handleNetworkError(error as Error);
    return false;
  }
}; 