import React, { useState } from 'react';
import { SafeAreaView, Alert, ScrollView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../src/styles/StyleFactory';

// Composants
import LocationForm from '../../src/components/LocationForm';
import { CommonHeader } from '../../src/components';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

// Hooks et Redux
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../src/store/store';
import { createLocation } from '../../src/store/locationsThunks';
import { useAppTheme } from '../../src/contexts/ThemeContext';

const AddLocationScreen = () => {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams();
  const dispatch = useDispatch<AppDispatch>();
  const { activeTheme } = useAppTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'LocationCard');

  const handleSubmit = async (locationData: any) => {
    if (isSubmitting) return false;
    
    try {
      setIsSubmitting(true);
      
      // Utiliser le thunk Redux pour créer l'emplacement
      const result = await dispatch(createLocation({
        name: locationData.name,
        address: locationData.address,
        description: locationData.description
      })).unwrap();
      
      if (result) {
        Alert.alert(
          'Succès',
          'Emplacement créé avec succès',
          [
            {
              text: 'OK',
              onPress: () => {
                if (returnTo && typeof returnTo === 'string') {
                  router.replace(returnTo);
                } else {
                  router.back();
                }
              }
            }
          ]
        );
        return true;
      } else {
        Alert.alert('Erreur', 'Impossible de créer l\'emplacement');
        return false;
      }
    } catch (error) {
      console.error('Erreur création emplacement:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la création');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (returnTo && typeof returnTo === 'string') {
      router.replace(returnTo);
    } else {
      router.back();
    }
  };

  const handleBackPress = () => {
    if (returnTo && typeof returnTo === 'string') {
      router.replace(returnTo);
    } else {
      router.back();
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <CommonHeader
          title="Ajouter un emplacement"
          onBackPress={handleBackPress}
        />
        
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}
          keyboardShouldPersistTaps="handled"
        >
          <LocationForm
            initialData={null}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
};

export default AddLocationScreen;