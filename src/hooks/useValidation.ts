import { useState, useCallback } from 'react';

interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
}

interface ValidationRules {
  [key: string]: ValidationRule;
}

export const useValidation = (rules: ValidationRules) => {
  const [errors, setErrors] = useState<string[]>([]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const validateField = useCallback((field: string, value: string) => {
    const fieldRules = rules[field];
    const fieldErrors: string[] = [];

    if (!fieldRules) return;

    if (fieldRules.required && !value.trim()) {
      fieldErrors.push(`Le champ ${field} est requis`);
    }

    if (fieldRules.minLength && value.length < fieldRules.minLength) {
      fieldErrors.push(`${field} doit contenir au moins ${fieldRules.minLength} caractères`);
    }

    if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
      fieldErrors.push(`${field} ne doit pas dépasser ${fieldRules.maxLength} caractères`);
    }

    if (fieldRules.pattern && !fieldRules.pattern.test(value)) {
      fieldErrors.push(`${field} contient des caractères non autorisés`);
    }

    if (fieldRules.min || fieldRules.max) {
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        if (fieldRules.min !== undefined && numValue < fieldRules.min) {
          fieldErrors.push(`${field} doit être supérieur à ${fieldRules.min}`);
        }
        if (fieldRules.max !== undefined && numValue > fieldRules.max) {
          fieldErrors.push(`${field} doit être inférieur à ${fieldRules.max}`);
        }
      }
    }

    setErrors(prev => [...prev.filter(err => !err.startsWith(field)), ...fieldErrors]);
    return fieldErrors;
  }, [rules]);

  const validateForm = useCallback((formData: Record<string, any>) => {
    const allErrors: Record<string, string[]> = {};
    
    Object.keys(rules).forEach(field => {
      const fieldErrors = validateField(field, formData[field]?.toString() || '');
      if (fieldErrors?.length) {
        allErrors[field] = fieldErrors;
      }
    });

    return allErrors;
  }, [rules, validateField]);

  return {
    errors,
    validateField,
    validateForm,
    clearErrors,
  };
}; 