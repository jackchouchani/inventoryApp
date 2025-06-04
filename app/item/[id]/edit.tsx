import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ItemEditForm } from '../../../src/components/ItemEditForm';
import { useAllCategories, useAllContainers } from '../../../src/hooks/useOptimizedSelectors';
import { useCategoriesOptimized as useCategories } from '../../../src/hooks/useCategoriesOptimized';
import { useContainersOptimized as useContainers } from '../../../src/hooks/useContainersOptimized';
import { useItem } from '../../../src/hooks/useItem';
import { Icon } from '../../../src/components';
import { TouchableOpacity } from 'react-native';
import { useAppTheme, type AppThemeType } from '../../../src/contexts/ThemeContext';

export default function ItemEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { activeTheme } = useAppTheme();
  
  // Utiliser les hooks optimisés pour forcer le chargement des données
  useCategories(); // Force le chargement des categories
  useContainers(); // Force le chargement des containers
  
  // Puis récupérer les données depuis les sélecteurs
  const categories = useAllCategories();
  const containers = useAllContainers();
  const { item, isLoading: isLoadingItem, error: errorItem } = useItem(id ? Number(id) : null);

  console.log('[ItemEditScreen] Categories loaded:', categories?.length);
  console.log('[ItemEditScreen] Containers loaded:', containers?.length);

  const handleSuccess = () => {
    console.log('[ItemEditScreen] Succès de la modification, retour vers la page info');
    // Après succès, retourner vers la page info de l'article
    router.replace(`/item/${id}/info`);
  };

  const handleCancel = () => {
    console.log('[ItemEditScreen] Annulation, retour vers la page info');
    // Retourner vers la page info de l'article
    router.replace(`/item/${id}/info`);
  };

  // Loading state - attendre que les données item soient chargées (categories et containers sont toujours disponibles)
  const isLoading = isLoadingItem;
  
  const styles = getThemedStyles(activeTheme);
  
  if (isLoading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
        <Text style={styles.loadingText}>Chargement de l'article...</Text>
      </View>
    );
  }

  // Error state
  const error = errorItem;
  if (error || !item) {
    return (
      <View style={styles.centerContent}>
        <Icon name="error_outline" size={80} color={activeTheme.error} />
        <Text style={styles.errorText}>
          {error || 'Article introuvable'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Icon name="arrow_back" size={24} color="#ffffff" />
          <Text style={styles.buttonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ItemEditForm
        item={item}
        categories={categories || []}
        containers={containers || []}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </View>
  );
}

const getThemedStyles = (theme: AppThemeType) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  loadingText: {
    fontSize: 16,
    color: theme.text.secondary,
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: theme.error,
    fontWeight: '500',
    marginVertical: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: theme.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 