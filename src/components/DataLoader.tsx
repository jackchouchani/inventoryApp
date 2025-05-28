import React, { memo, useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useSegments } from 'expo-router';
import { useInitialData } from '../hooks/useInitialData';

interface DataLoaderProps {
  children: React.ReactNode;
  onLoadComplete?: () => void;
  showLoadingUI?: boolean;
}

const theme = {
  colors: {
    primary: '#007AFF'
  }
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
});

export const DataLoader: React.FC<DataLoaderProps> = memo(({ 
  children, 
  onLoadComplete,
  showLoadingUI = true 
}) => {
  const [hasCalledComplete, setHasCalledComplete] = useState(false);
  const { isLoading, error } = useInitialData();
  const { user } = useAuth();
  const segments = useSegments();
  const isAuthGroup = segments[0] === "(auth)";

  useEffect(() => {
    if (!hasCalledComplete && !isLoading) {
      setHasCalledComplete(true);
      onLoadComplete?.();
    }
  }, [isLoading, hasCalledComplete, onLoadComplete]);

  if (isAuthGroup) {
    return <>{children}</>;
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          Une erreur est survenue lors du chargement des données
        </Text>
        <Text style={styles.errorDetail}>
          {typeof error === 'string' ? error : error.message}
        </Text>
      </View>
    );
  }

  if (isLoading && showLoadingUI) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Chargement des données...</Text>
      </View>
    );
  }

  return <>{children}</>;
}); 