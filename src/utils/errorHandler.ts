import { PostgrestError } from '@supabase/supabase-js';
import Toast from 'react-native-toast-message';
import * as Sentry from '@sentry/react-native';

// Types d'erreurs
export enum ErrorType {
  DATABASE = 'DATABASE',
  AUTHENTICATION = 'AUTHENTICATION',
  NETWORK = 'NETWORK',
  SCANNER = 'SCANNER',
  VALIDATION = 'VALIDATION',
  UNKNOWN = 'UNKNOWN'
}

// Structure pour les messages d'erreur traduits
interface ErrorMessage {
  fr: string;
  en: string;
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
const genericErrors: Record<ErrorType, ErrorMessage> = {
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
  }
};

// Options pour le logging des erreurs
interface ErrorOptions {
  context?: string;
  additionalData?: Record<string, any>;
  shouldNotify?: boolean;
  customMessage?: ErrorMessage;
}

export interface ErrorDetails {
  message: string;
  type: ErrorType;
  code?: string;
  context?: string;
}

// Fonction principale de gestion des erreurs
export const handleError = (
  error: unknown,
  type: ErrorType = ErrorType.UNKNOWN,
  options: ErrorOptions = {}
): ErrorDetails => {
  const { context, additionalData, shouldNotify = true, customMessage } = options;

  // Log l'erreur dans Sentry
  Sentry.captureException(error, {
    extra: {
      type,
      context,
      additionalData
    },
  });

  // Log l'erreur en console en développement
  if (__DEV__) {
    console.error(`Error in ${context} (${type}):`, error);
  }

  // Déterminer le message d'erreur
  let errorMessage: ErrorMessage;
  
  if (customMessage) {
    errorMessage = customMessage;
  } else if (error instanceof Error && 'code' in error) {
    const code = (error as any).code;
    errorMessage = supabaseErrorCodes[code] || genericErrors[type];
  } else {
    errorMessage = genericErrors[type];
  }

  // Afficher un toast si nécessaire
  if (shouldNotify) {
    Toast.show({
      type: 'error',
      text1: 'Erreur',
      text2: errorMessage.fr,
      position: 'bottom',
      visibilityTime: 4000,
      autoHide: true,
    });
  }

  return {
    message: errorMessage.fr,
    type,
    code: error instanceof Error && 'code' in error ? (error as any).code : undefined,
    context
  };
};

// Fonctions utilitaires spécialisées
export const handleValidationError = (message: string, context?: string) => {
  return handleError(new Error(message), ErrorType.VALIDATION, { context });
};

export const handleAuthError = (error: Error, context?: string) => {
  return handleError(error, ErrorType.AUTHENTICATION, { context });
};

export const handleDatabaseError = (error: PostgrestError | Error, context?: string) => {
  return handleError(error, ErrorType.DATABASE, { context });
};

export const handleScannerError = (error: Error, context?: string) => {
  return handleError(error, ErrorType.SCANNER, { context });
};

export const handleNetworkError = (error: Error, context?: string) => {
  let networkErrorType = 'network/unknown';
  
  if (error.message.includes('timeout')) {
    networkErrorType = 'network/timeout';
  } else if (error.message.includes('offline') || error.message.includes('internet')) {
    networkErrorType = 'network/no-connection';
  }

  const errorMessage = supabaseErrorCodes[networkErrorType] || {
    fr: 'Erreur de connexion réseau.',
    en: 'Network connection error.'
  };

  return handleError(error, ErrorType.NETWORK, {
    context,
    additionalData: { networkErrorType },
    customMessage: errorMessage
  });
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
    handleNetworkError(error as Error, 'checkNetworkConnection');
    return false;
  }
}; 