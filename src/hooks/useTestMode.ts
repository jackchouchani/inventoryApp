import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TestConflictService } from '../services/TestConflictService';

const TEST_MODE_KEY = '@test_mode_enabled';

export const useTestMode = () => {
  const [isTestModeEnabled, setIsTestModeEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [testDataCount, setTestDataCount] = useState({ conflicts: 0, events: 0 });

  const testService = TestConflictService.getInstance();

  // Charger l'état du mode test depuis AsyncStorage
  useEffect(() => {
    const loadTestMode = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(TEST_MODE_KEY);
        if (savedMode !== null) {
          const enabled = JSON.parse(savedMode);
          console.log('Loading test mode from storage:', enabled);
          setIsTestModeEnabled(enabled);
          testService.setTestMode(enabled);
        }
        
        // Charger le nombre de données de test
        const count = await testService.getTestDataCount();
        setTestDataCount(count);
      } catch (error) {
        console.warn('Erreur lors du chargement du mode test:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTestMode();
  }, []);

  useEffect(() => {
    console.log('useTestMode - isTestModeEnabled changed to:', isTestModeEnabled);
  }, [isTestModeEnabled]);

  const toggleTestMode = async (enabled: boolean) => {
    console.log('toggleTestMode called with:', enabled);
    try {
      await AsyncStorage.setItem(TEST_MODE_KEY, JSON.stringify(enabled));
      console.log('AsyncStorage updated successfully');
      
      setIsTestModeEnabled(enabled);
      testService.setTestMode(enabled);
      
      // Si on désactive le mode test, nettoyer les données
      if (!enabled) {
        await testService.cleanup();
        setTestDataCount({ conflicts: 0, events: 0 });
      } else {
        // Si on active le mode test, recharger le compteur
        await refreshTestDataCount();
      }
      
      console.log('Test mode toggled successfully to:', enabled);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du mode test:', error);
    }
  };

  const refreshTestDataCount = async () => {
    try {
      const count = await testService.getTestDataCount();
      setTestDataCount(count);
    } catch (error) {
      console.warn('Erreur lors du rafraîchissement du compteur:', error);
    }
  };

  const cleanupTestData = async () => {
    try {
      await testService.cleanup();
      await refreshTestDataCount();
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
      throw error;
    }
  };

  return {
    isTestModeEnabled,
    isLoading,
    testDataCount,
    toggleTestMode,
    refreshTestDataCount,
    cleanupTestData,
    testService
  };
};