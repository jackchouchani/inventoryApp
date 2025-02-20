import { useState, useCallback } from 'react';
import { secureStorage } from '../services/secureStorage';
import * as Sentry from '@sentry/react-native';

export const useSecureStorage = (key: string) => {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getStoredValue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const storedValue = await secureStorage.getItem(key);
      setValue(storedValue);
      return storedValue;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { context: 'secure_storage', operation: 'get' }
      });
      setError('Erreur lors de la récupération des données');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [key]);

  const setStoredValue = useCallback(async (newValue: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await secureStorage.setItem(key, newValue);
      setValue(newValue);
      return true;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { context: 'secure_storage', operation: 'set' }
      });
      setError('Erreur lors de la sauvegarde des données');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [key]);

  const removeStoredValue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await secureStorage.removeItem(key);
      setValue(null);
      return true;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { context: 'secure_storage', operation: 'remove' }
      });
      setError('Erreur lors de la suppression des données');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [key]);

  return {
    value,
    setValue: setStoredValue,
    remove: removeStoredValue,
    get: getStoredValue,
    error,
    isLoading,
  };
}; 