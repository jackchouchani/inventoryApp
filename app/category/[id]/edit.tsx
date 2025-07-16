import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { useUserPermissions } from '../../../src/hooks/useUserPermissions';
import { selectCategoryById, editCategory } from '../../../src/store/categorySlice';
import { RootState } from '../../../src/store/store';
import { CategoryForm, type CategoryFormData } from '../../../src/components/CategoryForm';
import Toast from 'react-native-toast-message';
import * as Sentry from '@sentry/react-native';
import type { MaterialIconName } from '../../../src/types/icons';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../src/contexts/ThemeContext';
import { Icon } from '../../../src/components';
import StyleFactory from '../../../src/styles/StyleFactory';

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useDispatch();
  const { activeTheme } = useAppTheme();
  const userPermissions = useUserPermissions();
  const [loading, setLoading] = useState(false);

  // Vérifier les permissions
  useEffect(() => {
    if (!userPermissions.canUpdateCategories) {
      router.replace('/(tabs)/stock');
      return;
    }
  }, [userPermissions.canUpdateCategories, router]);

  // Si pas de permission, ne pas rendre le contenu
  if (!userPermissions.canUpdateCategories) {
    return (
      <View style={{ flex: 1, backgroundColor: activeTheme.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: activeTheme.text.primary, fontSize: 16 }}>
          Accès non autorisé - Permission requise pour modifier les catégories
        </Text>
      </View>
    );
  }
  
  const categoryId = id ? parseInt(id, 10) : null;
  const category = useSelector((state: RootState) => 
    categoryId ? selectCategoryById(state, categoryId) : null
  );

  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'CategoryCard');

  const handleSubmit = async (data: CategoryFormData) => {
    if (!category || !categoryId) return;
    
    try {
      setLoading(true);

      // Convertir la date en chaîne ISO pour la sérialisation Redux
      const isoDate = new Date().toISOString();

      const payload = {
        id: categoryId,
        name: data.name.trim(),
        description: data.description.trim() || undefined,
        icon: data.icon,
        updatedAt: isoDate
      };

      await dispatch(editCategory(payload));
      Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: 'Catégorie mise à jour avec succès'
      });
      router.back();
    } catch (error) {
      Sentry.captureException(error, {
        extra: {
          categoryId,
          action: 'edit_category'
        }
      });
      Toast.show({
        type: 'error',
        text1: 'Erreur de mise à jour',
        text2: 'Une erreur est survenue lors de la mise à jour de la catégorie'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  // Gestion du cas où la catégorie n'existe pas
  if (!categoryId || isNaN(categoryId)) {
    return (
      <SafeAreaView style={[
        styles.errorContainer, 
        Platform.OS === 'web' ? { paddingTop: 0 } : {}
      ]}>
        <Icon name="error" size={48} color={activeTheme.danger.main} />
        <Text style={styles.errorTitle}>ID de catégorie invalide</Text>
        <Text style={styles.errorText}>L'ID fourni n'est pas valide</Text>
      </SafeAreaView>
    );
  }

  if (!category) {
    return (
      <SafeAreaView style={[
        styles.loadingContainer, 
        Platform.OS === 'web' ? { paddingTop: 0 } : {}
      ]}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
        <Text style={styles.loadingText}>Chargement de la catégorie...</Text>
      </SafeAreaView>
    );
  }

  const initialData: CategoryFormData = {
    name: category.name,
    description: category.description || '',
    icon: (category.icon as MaterialIconName) || 'folder'
  };

  return (
    <CategoryForm
      initialData={initialData}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      submitButtonText="Enregistrer"
      title="Modifier la catégorie"
      loading={loading}
    />
  );
} 