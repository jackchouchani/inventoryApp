import { PostgrestError } from '@supabase/supabase-js';
import Toast from 'react-native-toast-message';
import * as Sentry from '@sentry/react-native';
import { Platform, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { AuthError } from '@supabase/supabase-js';

// Types d'erreurs
export enum ErrorTypeEnum {
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  UNKNOWN = 'UNKNOWN'
}

export const ErrorType = ErrorTypeEnum;

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
  context: string;
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
  [ErrorType.VALIDATION]: {
    fr: 'Erreur de validation des données.',
    en: 'Data validation error.'
  },
  [ErrorType.UNKNOWN]: {
    fr: 'Une erreur inattendue s\'est produite.',
    en: 'An unexpected error occurred.'
  },
};

interface ErrorContext {
    context: string;
    [key: string]: any;
}

interface ErrorHandlerOptions {
  showAlert?: boolean;
  logToSentry?: boolean;
  source?: string;
  message?: string;
  additionalData?: Record<string, any>;
}

/**
 * Gère les erreurs de manière centralisée
 * @param error - L'erreur à gérer
 * @param message - Message d'erreur à afficher à l'utilisateur
 * @param options - Options de gestion d'erreur
 */
export const handleError = (
  error: Error | AuthError | unknown,
  message: string,
  options: ErrorHandlerOptions = { showAlert: true, logToSentry: true }
) => {
  // Log l'erreur en console en développement
  if (__DEV__) {
    console.error(message, error);
  }

  // Log l'erreur dans Sentry en production
  if (options.logToSentry) {
    Sentry.captureException(error, {
      extra: { message }
    });
  }

  // Afficher une alerte à l'utilisateur
  if (options.showAlert) {
    if (Platform.OS === 'web') {
      alert(message);
    } else {
      Alert.alert('Erreur', message);
    }
  }

  // Gérer les erreurs spécifiques
  if (error instanceof AuthError) {
    processAuthError(error);
  }
};

/**
 * Traite les erreurs d'authentification en interne
 * @param error - L'erreur d'authentification
 */
const processAuthError = (error: AuthError) => {
  switch (error.status) {
    case 401:
      // Rediriger vers la page de connexion
      break;
    case 403:
      // Gérer les erreurs de permission
      break;
    default:
      // Gérer les autres erreurs d'auth
      break;
  }
};

class ErrorHandler {
  handleError(error: unknown, { context, severity = 'error', extraData }: ErrorContext): ErrorDetails {
    console.error(`[${context}]`, error);

    // Enrichir le contexte pour Sentry
    const errorContext = {
      timestamp: new Date().toISOString(),
      context,
      ...extraData,
      deviceInfo: {
        platform: Platform.OS,
        version: Platform.Version,
        brand: Platform.select({
          ios: 'Apple',
          android: 'Android',
          default: 'Unknown'
        })
      },
      appState: {
        isConnected: NetInfo.useNetInfo().isConnected,
        lastAction: extraData?.lastAction || 'unknown'
      }
    };

    // Configurer les breadcrumbs pour Sentry
    Sentry.addBreadcrumb({
      category: context,
      message: this.getErrorMessage(error),
      level: severity as Sentry.SeverityLevel,
      data: errorContext
    });

    // Capturer l'exception avec le contexte enrichi
    Sentry.captureException(error, {
      level: severity as Sentry.SeverityLevel,
      contexts: {
        error: errorContext
      },
      tags: {
        errorType: context,
        errorCode: error instanceof Error && 'code' in error ? (error as any).code : 'unknown'
      }
    });

    // Afficher le toast avec un style amélioré
    Toast.show({
      type: severity === 'error' ? 'error' : 'info',
      text1: this.getErrorTitle(context),
      text2: this.getErrorMessage(error),
      position: 'bottom',
      visibilityTime: 4000,
      props: {
        style: {
          borderLeftColor: severity === 'error' ? '#FF3B30' : '#007AFF'
        }
      }
    });

    return {
      message: this.getErrorMessage(error),
      type: context as ErrorTypeEnum,
      originalError: error,
      code: error instanceof Error && 'code' in error ? (error as any).code : undefined,
      context: errorContext
    };
  }

  private getErrorTitle(context: string): string {
    switch (context) {
      case ErrorType.DATABASE:
        return 'Erreur de base de données';
      case ErrorType.AUTHENTICATION:
        return 'Erreur d\'authentification';
      case ErrorType.NETWORK:
        return 'Erreur réseau';
      case ErrorType.VALIDATION:
        return 'Erreur de validation';
      default:
        return 'Erreur';
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      if ('code' in error && typeof (error as any).code === 'string') {
        const code = (error as any).code;
        return supabaseErrorCodes[code]?.fr || genericErrors[ErrorType.UNKNOWN].fr;
      }
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return genericErrors[ErrorType.UNKNOWN].fr;
  }
}

export const errorHandler = new ErrorHandler();

// Fonctions utilitaires spécialisées
export const handleValidationError = (message: string): ErrorDetails => {
  return errorHandler.handleError(new Error(message), { context: ErrorType.VALIDATION });
};

export const handleAuthError = (error: Error): ErrorDetails => {
  return errorHandler.handleError(error, { context: ErrorType.AUTHENTICATION });
};

export const handleDatabaseError = (error: PostgrestError | Error): ErrorDetails => {
  return errorHandler.handleError(error, { context: ErrorType.DATABASE });
};

export const handleScannerError = (error: Error): ErrorDetails => {
  return errorHandler.handleError(error, { context: ErrorType.UNKNOWN });
};

export const handleNetworkError = (error: Error): ErrorDetails => {
  // Détecter le type d'erreur réseau
  let networkErrorType = 'network/unknown';
  
  if (error.message.includes('timeout')) {
    networkErrorType = 'network/timeout';
  } else if (error.message.includes('offline') || error.message.includes('internet')) {
    networkErrorType = 'network/no-connection';
  }

  return errorHandler.handleError(error, { 
    context: ErrorType.NETWORK,
    extraData: { networkErrorType }
  });
}; 