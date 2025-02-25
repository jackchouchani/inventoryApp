import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { database } from '../../src/database/database';
import { addNewCategory } from '../../src/store/categorySlice';
import type { CategoryInput } from '../../src/types/category';
import { CategoryForm, type CategoryFormData } from '../../src/components/CategoryForm';
import Toast from 'react-native-toast-message';
import * as Sentry from '@sentry/react-native';

export default function AddCategoryScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: CategoryFormData) => {
    try {
      setLoading(true);

      const categoryInput: CategoryInput = {
        name: data.name.trim(),
        description: data.description.trim(),
        icon: data.icon
      };

      const categoryId = await database.addCategory(categoryInput);
      
      // Utiliser des chaînes ISO au lieu d'objets Date pour Redux
      const now = new Date();
      const isoDate = now.toISOString();

      dispatch(addNewCategory({
        id: categoryId,
        ...categoryInput,
        createdAt: isoDate,
        updatedAt: isoDate
      }));

      Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: 'Catégorie créée avec succès'
      });
      router.back();
    } catch (error) {
      Sentry.captureException(error, {
        extra: {
          action: 'addCategory',
          categoryData: data
        }
      });
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de créer la catégorie'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CategoryForm
      onSubmit={handleSubmit}
      submitButtonText="Ajouter"
      title="Nouvelle catégorie"
      loading={loading}
    />
  );
} 