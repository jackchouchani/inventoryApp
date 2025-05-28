import React, { useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../src/contexts/ThemeContext';
import ItemForm from '../../src/components/ItemForm';
import { useCategories } from '../../src/hooks/useCategories';
import { useContainers } from '../../src/hooks/useContainers';
import { useItems } from '../../src/hooks/useItems';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { handleNetworkError } from '../../src/utils/errorHandler';

const AddScreenContent: React.FC = () => {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  
  // Utiliser les hooks Redux
  const { data: containers = [], isLoading: containersLoading, error: containersError } = useContainers();
  const { categories, isLoading: categoriesLoading, error: categoriesError } = useCategories();
  const { isLoading: itemsLoading, error: itemsError, refetch: refetchItems } = useItems();

  const isLoading = containersLoading || categoriesLoading || itemsLoading;
  const error = containersError || categoriesError || itemsError;

  const handleSuccess = useCallback(() => {
    // Rafraîchir les items via Redux
    refetchItems();
    router.push('/(tabs)/stock');
  }, [refetchItems, router]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: activeTheme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={activeTheme.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    handleNetworkError(new Error(error));
    throw new Error(error);
  }

  return (
    <View style={[styles.container, { backgroundColor: activeTheme.background }]}>
      <View style={styles.content}>
        <ItemForm 
          containers={containers} 
          categories={categories}
          onSuccess={handleSuccess}
        />
      </View>
    </View>
  );
};

export default function AddScreen() {
  const handleReset = useCallback(() => {
    // Plus besoin de React Query - Redux gère le state
    console.log('Reset handled by Redux');
  }, []);

  return (
    <ErrorBoundary
      onReset={handleReset}
    >
      <AddScreenContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor sera défini par le thème
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    // color sera défini par le thème
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    // backgroundColor sera défini par le thème
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    // color sera défini par le thème
    fontSize: 16,
    fontWeight: '600',
  },
});
