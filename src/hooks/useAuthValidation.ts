import { useCallback } from 'react';
import Toast from 'react-native-toast-message';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD_MIN_LENGTH = 6;

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const useAuthValidation = () => {
  const validateEmail = useCallback((email: string): ValidationResult => {
    const errors: string[] = [];
    
    if (!email.trim()) {
      errors.push('Email requis');
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.push('Format d\'email invalide');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }, []);

  const validatePassword = useCallback((password: string): ValidationResult => {
    const errors: string[] = [];
    
    if (!password) {
      errors.push('Mot de passe requis');
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      errors.push(`Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }, []);

  const validatePasswordConfirmation = useCallback((password: string, confirmation: string): ValidationResult => {
    const errors: string[] = [];
    
    if (!confirmation) {
      errors.push('Confirmation du mot de passe requise');
    } else if (password !== confirmation) {
      errors.push('Les mots de passe ne correspondent pas');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }, []);

  const showValidationError = useCallback((error: string) => {
    Toast.show({
      type: 'error',
      text1: 'Erreur de validation',
      text2: error
    });
  }, []);

  return {
    validateEmail,
    validatePassword,
    validatePasswordConfirmation,
    showValidationError
  };
}; 