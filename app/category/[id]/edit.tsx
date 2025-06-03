import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { selectCategoryById, editCategory } from '../../../src/store/categorySlice';
import { RootState } from '../../../src/store/store';
import { CategoryForm, type CategoryFormData } from '../../../src/components/CategoryForm';
import Toast from 'react-native-toast-message';
import * as Sentry from '@sentry/react-native';
import type { MaterialIconName } from '../../../src/types/icons';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAppTheme } from '../../../src/contexts/ThemeContext';
import { Icon } from '../../../src/components';
import StyleFactory from '../../../src/styles/StyleFactory';

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useDispatch();
  const { activeTheme } = useAppTheme();
  const [loading, setLoading] = useState(false);
  
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
      <View style={styles.errorContainer}>
        <Icon name="error" size={48} color={activeTheme.danger.main} />
        <Text style={styles.errorTitle}>ID de catégorie invalide</Text>
        <Text style={styles.errorText}>L'ID fourni n'est pas valide</Text>
      </View>
    );
  }

  if (!category) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
        <Text style={styles.loadingText}>Chargement de la catégorie...</Text>
      </View>
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