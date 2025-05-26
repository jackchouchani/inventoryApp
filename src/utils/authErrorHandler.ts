import { AuthError } from '@supabase/supabase-js';
import { handleError } from './errorHandler';
import { getLocales } from 'expo-localization';

// Fonction utilitaire pour obtenir la langue de l'utilisateur
const getUserLanguage = (): 'fr' | 'en' => {
  const locales = getLocales();
  return locales[0]?.languageCode === 'fr' ? 'fr' : 'en';
};
import * as Sentry from '@sentry/react-native';

// Messages d'erreur spécifiques à l'authentification
const authErrorMessages: Record<string, { fr: string; en: string }> = {
  'auth/invalid-email': {
    fr: 'Adresse email invalide.',
    en: 'Invalid email address.'
  },
  'auth/user-disabled': {
    fr: 'Ce compte a été désactivé.',
    en: 'This account has been disabled.'
  },
  'auth/user-not-found': {
    fr: 'Aucun compte ne correspond à cet email.',
    en: 'No account found with this email.'
  },
  'auth/wrong-password': {
    fr: 'Mot de passe incorrect.',
    en: 'Incorrect password.'
  },
  'auth/email-already-in-use': {
    fr: 'Cette adresse email est déjà utilisée.',
    en: 'This email is already in use.'
  },
  'auth/weak-password': {
    fr: 'Le mot de passe doit contenir au moins 6 caractères.',
    en: 'Password should be at least 6 characters.'
  },
  'auth/invalid-login-credentials': {
    fr: 'Email ou mot de passe incorrect.',
    en: 'Invalid email or password.'
  },
  'auth/too-many-requests': {
    fr: 'Trop de tentatives de connexion. Veuillez réessayer plus tard.',
    en: 'Too many login attempts. Please try again later.'
  },
  'auth/network-request-failed': {
    fr: 'Erreur de connexion réseau. Vérifiez votre connexion internet.',
    en: 'Network error. Check your internet connection.'
  }
};

export const handleAuthenticationError = (error: AuthError | Error, context?: string) => {
  // Déterminer le code d'erreur
  let errorCode = 'unknown';
  if (error instanceof AuthError) {
    errorCode = error.message;
  } else if ('code' in error) {
    errorCode = error.code as string;
  }

  // Récupérer le message d'erreur spécifique ou utiliser un message générique
  const errorMessage = authErrorMessages[errorCode] || {
    fr: 'Une erreur est survenue l\'authentification.',
    en: 'An authentication error occurred.'
  };

  const userLanguage = getUserLanguage();
  const message = errorMessage[userLanguage as keyof typeof errorMessage] || errorMessage.en;
  
  return handleError(
    error,
    message,
    {
      source: context,
      additionalData: { errorCode },
      showAlert: true,
      logToSentry: true
    }
  );
};

// Fonction utilitaire pour les erreurs de validation du formulaire d'authentification
export const handleAuthValidationError = (field: string, context?: string) => {
  const validationMessages: Record<string, { fr: string; en: string }> = {
    email: {
      fr: 'Veuillez entrer une adresse email valide.',
      en: 'Please enter a valid email address.'
    },
    password: {
      fr: 'Le mot de passe doit contenir au moins 6 caractères.',
      en: 'Password must be at least 6 characters long.'
    },
    confirmPassword: {
      fr: 'Les mots de passe ne correspondent pas.',
      en: 'Passwords do not match.'
    }
  };

  const message = validationMessages[field] || {
    fr: 'Champ invalide.',
    en: 'Invalid field.'
  };

  const userLanguage = getUserLanguage();
  const messageText = message[userLanguage as keyof typeof message] || message.en;
  
  return handleError(
    new Error(`Invalid ${field}`),
    messageText,
    {
      source: context,
      additionalData: { field },
      showAlert: true,
      logToSentry: true
    }
  );
};

export const handleAuthError = (error: AuthError): string => {
  Sentry.captureException(error, {
    tags: {
      context: 'authentication',
    },
  });

  switch (error.message) {
    case 'Invalid login credentials':
      return 'Identifiants invalides. Veuillez vérifier votre email et mot de passe.';
    case 'User already registered':
      return 'Un compte existe déjà avec cet email.';
    case 'Email not confirmed':
      return 'Veuillez confirmer votre email avant de vous connecter.';
    case 'Password is too short':
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    case 'Invalid email':
      return 'L\'adresse email n\'est pas valide.';
    default:
      return `Erreur d'authentification: ${error.message}`;
  }
}; 