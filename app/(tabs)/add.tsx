import React, { useCallback, useEffect } from 'react';
import { View, ActivityIndicator, StatusBar, Platform, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../src/contexts/ThemeContext';
import { useUserPermissions } from '../../src/hooks/useUserPermissions';
import ItemForm from '../../src/components/ItemForm';

// ✅ HOOKS OPTIMISÉS selon optimizations-hooks.mdc
import { useAllCategories, useAllContainers, useAllLocations } from '../../src/hooks/useOptimizedSelectors';
import { useItems } from '../../src/hooks/useItems';
import { useLocationsOptimized } from '../../src/hooks/useLocationsOptimized';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc  
import StyleFactory from '../../src/styles/StyleFactory';

import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { handleNetworkError } from '../../src/utils/errorHandler';

const AddScreenContent: React.FC = () => {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const userPermissions = useUserPermissions();
  
  
  // Si les permissions ne sont pas encore chargées, afficher un loading
  if (userPermissions.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: activeTheme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
        <Text style={{ color: activeTheme.text.primary, fontSize: 16, marginTop: 10 }}>
          Vérification des permissions...
        </Text>
      </View>
    );
  }
  
  // Si pas de permission, afficher un message et un bouton pour retourner
  if (!userPermissions.canCreateItems) {
    return (
      <View style={{ flex: 1, backgroundColor: activeTheme.background, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: activeTheme.text.primary, fontSize: 16, textAlign: 'center', marginBottom: 20 }}>
          Accès non autorisé - Permission requise pour créer des articles
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: activeTheme.primary,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 5,
          }}
          onPress={() => router.push('/(tabs)/stock')}
        >
          <Text style={{ color: activeTheme.text.onPrimary, fontSize: 16 }}>
            Retour au stock
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // ✅ HOOKS OPTIMISÉS - Utiliser les sélecteurs mémoïsés
  useLocationsOptimized(); // Force le chargement des locations
  const containers = useAllContainers();
  const categories = useAllCategories();
  const locations = useAllLocations();
  const { isLoading: itemsLoading, error: itemsError, refetch: refetchItems } = useItems();

  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemForm');

  const handleSuccess = useCallback(() => {
    // Rafraîchir les items via Redux
    refetchItems();
    router.push('/(tabs)/stock');
  }, [refetchItems, router]);

  // Styles optimisés pour mobile
  const containerStyle = {
    flex: 1,
    backgroundColor: activeTheme.background,
    paddingTop: Platform.OS === 'web' ? 0 : insets.top,
  };

  const loadingContainerStyle = {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: activeTheme.background,
  };

  if (itemsLoading) {
    return (
      <View style={containerStyle}>
        <StatusBar 
          backgroundColor={activeTheme.background} 
          barStyle={activeTheme === activeTheme ? 'light-content' : 'dark-content'} 
        />
        <View style={loadingContainerStyle}>
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
    <View style={containerStyle}>
      <StatusBar 
        backgroundColor={activeTheme.background} 
        barStyle={activeTheme === activeTheme ? 'light-content' : 'dark-content'} 
      />
      <ItemForm 
        containers={containers} 
        categories={categories}
        locations={locations}
        onSuccess={handleSuccess}
      />
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
