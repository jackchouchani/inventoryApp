import React, { useState } from 'react';
import { SafeAreaView, Alert, ScrollView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../src/styles/StyleFactory';

// Composants
import { ContainerForm } from '../../src/components/ContainerForm';
import { CommonHeader } from '../../src/components';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

// Hooks et Redux
import { useContainerManagement } from '../../src/hooks/useContainerManagement';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../src/store/store';
import { addContainer } from '../../src/store/containersSlice';
import { useAppTheme } from '../../src/contexts/ThemeContext';

const AddContainerScreen = () => {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams();
  const dispatch = useDispatch<AppDispatch>();
  const { activeTheme } = useAppTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { handleContainerSubmit } = useContainerManagement();
  
  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ContainerCard');

  const handleSubmit = async (containerData: any) => {
    if (isSubmitting) return false;
    
    try {
      setIsSubmitting(true);
      const result = await handleContainerSubmit(containerData);
      
      if (result.success && result.container) {
        dispatch(addContainer(result.container));
        Alert.alert(
          'Succès',
          'Container créé avec succès',
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
        Alert.alert('Erreur', 'Impossible de créer le container');
        return false;
      }
    } catch (error) {
      console.error('Erreur création container:', error);
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
      <SafeAreaView style={[
        styles.container, 
        Platform.OS === 'web' ? { paddingTop: 0 } : {}
      ]}>
        {/* ✅ COMMONHEADER - Header standardisé */}
        <CommonHeader 
          title="Nouveau Container"
          onBackPress={handleBackPress}
        />
        
        <ScrollView 
          style={styles.container}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <ContainerForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
};

export default AddContainerScreen; 