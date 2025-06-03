import React, { useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../src/contexts/ThemeContext';
import ItemForm from '../../src/components/ItemForm';

// ✅ HOOKS OPTIMISÉS selon optimizations-hooks.mdc
import { useAllCategories, useAllContainers } from '../../src/hooks/useOptimizedSelectors';
import { useItems } from '../../src/hooks/useItems';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc  
import StyleFactory from '../../src/styles/StyleFactory';

import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { handleNetworkError } from '../../src/utils/errorHandler';

const AddScreenContent: React.FC = () => {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  
  // ✅ HOOKS OPTIMISÉS - Utiliser les sélecteurs mémoïsés
  const containers = useAllContainers();
  const categories = useAllCategories();
  const { isLoading: itemsLoading, error: itemsError, refetch: refetchItems } = useItems();

  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemForm');

  const handleSuccess = useCallback(() => {
    // Rafraîchir les items via Redux
    refetchItems();
    router.push('/(tabs)/stock');
  }, [refetchItems, router]);

  if (itemsLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={activeTheme.primary} />
        </View>
      </View>
    );
  }

  if (itemsError) {
    handleNetworkError(new Error(itemsError));
    throw new Error(itemsError);
  }

  return (
    <View style={styles.container}>
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
    <ErrorBoundary onReset={handleReset}>
      <AddScreenContent />
    </ErrorBoundary>
  );
}
