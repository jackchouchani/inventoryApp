import React, { memo, useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useSegments } from 'expo-router';
import { useInitialData } from '../hooks/useInitialData';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { fetchItems } from '../store/itemsThunks';
import { fetchCategories } from '../store/categoriesThunks';
import { fetchContainers } from '../store/containersThunks';
import { fetchLocations } from '../store/locationsThunks';

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
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
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
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  timeoutContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 20,
  },
  timeoutText: {
    fontSize: 16,
    color: '#FF9500',
    textAlign: 'center',
    marginBottom: 12,
  },
  timeoutDetail: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
  },
});

export const DataLoader: React.FC<DataLoaderProps> = memo(({ 
  children, 
  onLoadComplete,
  showLoadingUI = true 
}) => {
  const [hasCalledComplete, setHasCalledComplete] = useState(false);
  const [showTimeout, setShowTimeout] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { isLoading, error } = useInitialData();
  const { user } = useAuth();
  const segments = useSegments();
  const isAuthGroup = segments[0] === "(auth)";
  const timeoutRef = useRef<NodeJS.Timeout>();
  const dispatch = useDispatch<AppDispatch>();

  // Timeout de sécurité pour détecter les blocages
  useEffect(() => {
    if (isLoading && showLoadingUI && !isAuthGroup && user) {
      // Timeout de 15 secondes pour afficher l'option de retry
      timeoutRef.current = setTimeout(() => {
        console.warn('⚠️ DataLoader timeout détecté après 15s');
        setShowTimeout(true);
      }, 15000);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
      setShowTimeout(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isLoading, showLoadingUI, isAuthGroup, user]);

  useEffect(() => {
    if (!hasCalledComplete && !isLoading) {
      setHasCalledComplete(true);
      setShowTimeout(false);
      onLoadComplete?.();
    }
  }, [isLoading, hasCalledComplete, onLoadComplete]);

  // Fonction pour forcer un rechargement
  const handleForceRefresh = () => {
    console.log('🔄 Tentative de rechargement forcé des données');
    setRetryCount(prev => prev + 1);
    setShowTimeout(false);
    
    if (Platform.OS === 'web' && retryCount >= 2) {
      // Après 3 tentatives, recharger la page
      console.log('🔄 Rechargement complet de la page après multiples échecs');
      window.location.reload();
      return;
    }

    // Tenter un refetch via Redux actions
    try {
      dispatch(fetchCategories());
      dispatch(fetchContainers());
      dispatch(fetchLocations());
      dispatch(fetchItems({ page: 0, limit: 50 }));
    } catch (error) {
      console.error('Erreur lors du refetch Redux:', error);
      
      // Fallback: recharger la page sur web
      if (Platform.OS === 'web') {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    }
  };

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
        <TouchableOpacity style={styles.retryButton} onPress={handleForceRefresh}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Afficher l'interface de timeout si nécessaire
  if (showTimeout && isLoading && showLoadingUI) {
    return (
      <View style={styles.timeoutContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.timeoutText}>
          Le chargement prend plus de temps que prévu...
        </Text>
        <Text style={styles.timeoutDetail}>
          Cela peut arriver après une longue période d'inactivité.
          {retryCount > 0 && ` (Tentative ${retryCount + 1}/3)`}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleForceRefresh}>
          <Text style={styles.retryButtonText}>
            {retryCount >= 2 ? 'Recharger la page' : 'Réessayer'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading && showLoadingUI) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Chargement des données...</Text>
        {retryCount > 0 && (
          <Text style={[styles.loadingText, { fontSize: 12, marginTop: 8 }]}>
            Tentative {retryCount + 1}
          </Text>
        )}
      </View>
    );
  }

  return <>{children}</>;
}); 