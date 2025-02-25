import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { checkNetworkConnection, subscribeToNetworkChanges } from '../utils/networkUtils';
import * as Sentry from '@sentry/react-native';

interface NetworkErrorBoundaryProps {
  children: React.ReactNode;
  onRetry?: () => void;
}

export const NetworkErrorBoundary: React.FC<NetworkErrorBoundaryProps> = ({
  children,
  onRetry,
}) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const connected = await checkNetworkConnection();
        setIsConnected(connected);
      } catch (error) {
        Sentry.captureException(error, {
          tags: { context: 'network_check' }
        });
      } finally {
        setIsChecking(false);
      }
    };

    const unsubscribe = subscribeToNetworkChanges((state) => {
      setIsConnected(state.isConnected ?? false);
    });

    checkConnection();

    return () => {
      unsubscribe();
    };
  }, []);

  const handleRetry = async () => {
    setIsChecking(true);
    try {
      const connected = await checkNetworkConnection();
      setIsConnected(connected);
      if (connected && onRetry) {
        onRetry();
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { context: 'network_retry' }
      });
    } finally {
      setIsChecking(false);
    }
  };

  if (isChecking) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Vérification de la connexion...</Text>
      </View>
    );
  }

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Pas de connexion Internet</Text>
        <Text style={styles.message}>
          Vérifiez votre connexion Internet et réessayez.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleRetry}>
          <Text style={styles.buttonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 