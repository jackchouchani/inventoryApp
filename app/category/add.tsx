import React, { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useDispatch } from 'react-redux';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createCategory } from '../../src/store/categoriesThunks';
import { AppDispatch } from '../../src/store/store';
import type { CategoryInput } from '../../src/types/category';
import { CategoryForm, type CategoryFormData } from '../../src/components/CategoryForm';
import Toast from 'react-native-toast-message';
import * as Sentry from '@sentry/react-native';

export default function AddCategoryScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams();
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: CategoryFormData) => {
    try {
      setLoading(true);

      const categoryInput: CategoryInput = {
        name: data.name.trim(),
        description: data.description.trim(),
        icon: data.icon
      };

      // ✅ UTILISER REDUX THUNK - Remplace database.addCategory + dispatch manuel
      await dispatch(createCategory(categoryInput)).unwrap();

      Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: 'Catégorie créée avec succès'
      });
      
      // Navigation modernisée avec Expo Router
      if (returnTo && typeof returnTo === 'string') {
        router.replace(returnTo);
      } else {
        router.back();
      }
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

  const handleCancel = () => {
    if (returnTo && typeof returnTo === 'string') {
      router.replace(returnTo);
    } else {
      router.back();
    }
  };

  return (
    <CategoryForm
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      submitButtonText="Ajouter"
      title="Nouvelle catégorie"
      loading={loading}
    />
  );
} 