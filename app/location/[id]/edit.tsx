import React, { useState, useEffect } from 'react';
import { Alert, ScrollView, ActivityIndicator, TouchableOpacity, Text, StyleSheet, View, SafeAreaView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../../src/styles/StyleFactory';

// Composants
import LocationForm from '../../../src/components/LocationForm';
import { CommonHeader, Icon } from '../../../src/components';
import { ErrorBoundary } from '../../../src/components/ErrorBoundary';
import ConfirmationDialog from '../../../src/components/ConfirmationDialog';

// Hooks et Redux
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../../src/store/store';
import { updateLocation as updateLocationThunk, deleteLocation } from '../../../src/store/locationsThunks';
import { useAllLocations } from '../../../src/hooks/useOptimizedSelectors';
import { selectAllItems, selectAllContainers } from '../../../src/store/selectors';
import { useAppTheme } from '../../../src/contexts/ThemeContext';

const EditLocationScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { activeTheme } = useAppTheme();
  
  const insets = useSafeAreaInsets();
  
  const locations = useAllLocations();
  const allItems = useSelector(selectAllItems);
  const allContainers = useSelector(selectAllContainers);
  const location = locations.find(l => l.id === parseInt(id || '0', 10));
  
  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'LocationCard');
  const localStyles = getLocalStyles();

  // État de sauvegarde
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Vérifier si l'emplacement existe

  useEffect(() => {
    if (!location && locations.length > 0) {
      Alert.alert(
        'Emplacement introuvable',
        'L\'emplacement demandé n\'existe pas.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [location, locations.length, router]);

  const handleSave = async (locationData: any) => {
    if (!location) return false;

    try {
      setIsSaving(true);
      
      // Mise à jour via thunk Redux
      const result = await dispatch(updateLocationThunk({
        id: location.id,
        updates: {
          name: locationData.name,
          address: locationData.address,
          description: locationData.description,
        }
      })).unwrap();

      if (result) {
        // Retourner à la page de contenu
        router.back();
        return true;
      } else {
        Alert.alert('Erreur', 'Impossible de modifier l\'emplacement');
        return false;
      }
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour de l\'emplacement:', error);
      Alert.alert('Erreur', error.message || 'Impossible de modifier l\'emplacement');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!location) return;

    try {
      // ✅ REDUX - Vérifier s'il y a des containers ou items dans cet emplacement depuis Redux (marche offline et online)
      const containers = allContainers.filter(container => container.locationId === location.id);
      const items = allItems.filter(item => item.locationId === location.id);

      if (containers.length > 0 || items.length > 0) {
        Alert.alert(
          'Impossible de supprimer',
          `Cet emplacement contient ${containers.length} container(s) et ${items.length} article(s). Veuillez d'abord les déplacer ou les supprimer.`
        );
        return;
      }

      // Supprimer via thunk Redux
      await dispatch(deleteLocation(location.id)).unwrap();

      Alert.alert(
        'Succès',
        'Emplacement supprimé avec succès',
        [{ text: 'OK', onPress: () => router.replace('/location') }]
      );

    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error);
      Alert.alert('Erreur', error.message || 'Impossible de supprimer l\'emplacement');
    } finally {
      setShowDeleteConfirmation(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (!location) {
    return (
      <SafeAreaView style={styles.container}>
        <CommonHeader
          title="Modifier l'emplacement"
          onBackPress={() => router.back()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={activeTheme.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>
        <CommonHeader
          title="Modifier l'emplacement"
          onBackPress={handleCancel}
          rightComponent={
            <TouchableOpacity
              style={localStyles.deleteButton}
              onPress={() => setShowDeleteConfirmation(true)}
              disabled={isSaving}
            >
              <Icon 
                name="delete" 
                size={24} 
                color={isSaving ? activeTheme.text.disabled : activeTheme.error} 
              />
            </TouchableOpacity>
          }
        />
        
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}
          keyboardShouldPersistTaps="handled"
        >
          <LocationForm
            initialData={location}
            onSubmit={handleSave}
            onCancel={handleCancel}
          />
        </ScrollView>

        <ConfirmationDialog
          visible={showDeleteConfirmation}
          title="Supprimer l'emplacement"
          message={`Êtes-vous sûr de vouloir supprimer l'emplacement "${location.name}" ?\n\nCette action est irréversible.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteConfirmation(false)}
          confirmText="Supprimer"
        />
      </SafeAreaView>
    </ErrorBoundary>
  );
};

const getLocalStyles = () => StyleSheet.create({
  deleteButton: {
    padding: 8,
    borderRadius: 8,
  },
});

export default EditLocationScreen;