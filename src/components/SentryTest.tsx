import React, { useEffect } from 'react';
import { View, Button, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';

const SentryTest: React.FC = () => {
  useEffect(() => {
    // Test d'erreur au montage du composant
    Sentry.captureMessage("Test de message Sentry au montage", "info");
  }, []);

  const generateError = () => {
    try {
      // Générer une erreur intentionnelle
      throw new Error("Test d'erreur pour Sentry");
    } catch (error) {
      Sentry.captureException(error);
    }
  };

  const generatePromiseError = () => {
    // Simuler une erreur asynchrone
    Promise.reject(new Error("Test d'erreur de promesse")).catch(error => {
      Sentry.captureException(error);
    });
  };

  const generateReduxError = () => {
    // Simuler une erreur dans une action Redux
    const fakeAction = { type: 'TEST_ERROR', payload: undefined };
    try {
      // @ts-ignore - Accès intentionnel à une propriété inexistante pour générer une erreur
      const value = fakeAction.payload.nonexistentProperty.something;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          location: 'redux_test',
          actionType: fakeAction.type,
        },
      });
    }
  };

  return (
    <View style={styles.container}>
      <Button 
        title="Générer une erreur simple" 
        onPress={generateError} 
      />
      <Button 
        title="Générer une erreur de promesse" 
        onPress={generatePromiseError} 
      />
      <Button 
        title="Simuler une erreur Redux" 
        onPress={generateReduxError} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 10,
  },
});

export default SentryTest; 