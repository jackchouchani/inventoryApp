import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { selectCategoryById, editCategory } from '../../src/store/categorySlice';
import { RootState } from '../../src/store/store';
import { CategoryForm, type CategoryFormData } from '../../src/components/CategoryForm';
import Toast from 'react-native-toast-message';
import * as Sentry from '@sentry/react-native';
import type { MaterialIconName } from '../../src/types/icons';

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  
  const categoryId = id ? parseInt(id, 10) : null;
  const category = useSelector((state: RootState) => 
    categoryId ? selectCategoryById(state, categoryId) : null
  );

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

  if (!category) {
    return null;
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
      submitButtonText="Enregistrer"
      title="Modifier la catégorie"
      loading={loading}
    />
  );
} 