import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../config/supabase';

interface DataLoaderProps {
  children: React.ReactNode;
  onLoadComplete?: () => void;
  showLoadingUI?: boolean;
}

export const DataLoader: React.FC<DataLoaderProps> = ({ 
  children, 
  onLoadComplete,
  showLoadingUI = false 
}) => {
  const [hasCalledComplete, setHasCalledComplete] = useState(false);

  const { 
    data: categories, 
    isLoading: isCategoriesLoading,
    error: categoriesError
  } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .is('deleted', false);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3
  });

  const { 
    data: containers, 
    isLoading: isContainersLoading,
    error: containersError
  } = useQuery({
    queryKey: ['containers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('containers')
        .select('*')
        .is('deleted', false);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3
  });

  useEffect(() => {
    if (!hasCalledComplete && categories && containers && !isCategoriesLoading && !isContainersLoading) {
      setHasCalledComplete(true);
      onLoadComplete?.();
    }
  }, [categories, containers, isCategoriesLoading, isContainersLoading, hasCalledComplete, onLoadComplete]);

  if (categoriesError || containersError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          Une erreur est survenue lors du chargement des données
        </Text>
        <Text style={styles.errorDetail}>
          {categoriesError?.message || containersError?.message}
        </Text>
      </View>
    );
  }

  if (isCategoriesLoading || isContainersLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement des données...</Text>
      </View>
    );
  }

  if (!categories?.length || !containers?.length) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initialisation des données...</Text>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
}); 