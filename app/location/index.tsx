import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, Text, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../src/styles/StyleFactory';
import { formatNumberWithSpaces } from '../../src/utils/format';

// Composants
import { LocationGrid } from '../../src/components/LocationGrid';
import { Icon, CommonHeader } from '../../src/components';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import ConfirmationDialog from '../../src/components/ConfirmationDialog';

// ✅ HOOKS OPTIMISÉS selon optimizations-hooks.mdc
import { useAllLocations, useLocationPageData } from '../../src/hooks/useOptimizedSelectors';
import { useLocationsOptimized as useLocations } from '../../src/hooks/useLocationsOptimized';

// Redux et services
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../src/store/store';
import { removeLocation } from '../../src/store/locationsSlice';
import { fetchItems } from '../../src/store/itemsThunks';
import { supabase } from '../../src/config/supabase';

// Hooks personnalisés
import { useAppTheme } from '../../src/contexts/ThemeContext';

const LocationIndexScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  
  // ✅ FORCER LE CHARGEMENT des emplacements depuis la DB
  const { refetch: refetchLocations } = useLocations();
  
  // ✅ HOOKS OPTIMISÉS - Utiliser les emplacements du store Redux (mis à jour par useLocations)
  const locations = useAllLocations();
  
  // Utiliser locationPageData pour forcer le chargement de TOUS les items et containers
  const { items, containers, isLoading: isLoadingItems } = useLocationPageData({
    status: 'all', // Tous les statuts pour avoir la liste complète
  });
  
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    locationId: number | null;
  }>({
    visible: false,
    locationId: null
  });

  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'LocationCard');
  const headerStyles = StyleFactory.getThemedStyles(activeTheme, 'CommonHeader');

  // Fonction de rafraîchissement qui force le rechargement de tous les items
  const refetchItems = useCallback(async () => {
    console.log('[LocationScreen] Forçage du rechargement de TOUS les items');
    await dispatch(fetchItems({ page: 0, limit: 10000 }));
  }, [dispatch]);

  const handleRefresh = useCallback(async () => {
    try {
      console.log('[LocationScreen] Rafraîchissement emplacements + items');
      await Promise.all([
        refetchItems(),
        refetchLocations()
      ]);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
    }
  }, [refetchItems, refetchLocations]);

  // Navigation vers le contenu de l'emplacement
  const handleLocationPress = useCallback((locationId: number) => {
    router.push(`/location/${locationId}/content`);
  }, [router]);

  // Navigation vers l'ajout d'emplacement
  const handleAddLocation = useCallback(() => {
    router.push('/location/add');
  }, [router]);

  const handleConfirmDelete = useCallback(async () => {
    const locationId = confirmDialog.locationId;
    if (!locationId) return;

    try {
      // Soft delete dans Supabase
      const { error: softDeleteLocationError } = await supabase
        .from('locations')
        .update({ deleted: true, updated_at: new Date().toISOString() })
        .eq('id', locationId);

      if (softDeleteLocationError) {
        throw new Error(`Impossible de supprimer l'emplacement : ${softDeleteLocationError.message}`);
      }

      // Mettre à jour Redux
      dispatch(removeLocation(locationId));

      // Fermer la boîte de dialogue et rafraîchir
      setConfirmDialog({ visible: false, locationId: null });
      Alert.alert('Succès', 'Emplacement supprimé avec succès');
      
      // Rafraîchir pour recharger les données
      await handleRefresh();

    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Erreur lors de la suppression');
    }
  }, [confirmDialog.locationId, dispatch, handleRefresh]);

  const handleDeleteLocation = useCallback((locationId: number) => {
    // Vérifier s'il y a des containers ou items dans cet emplacement
    const locationContainers = containers.filter(container => container.locationId === locationId);
    const locationItems = items.filter(item => item.locationId === locationId);
    
    if (locationContainers.length > 0 || locationItems.length > 0) {
      Alert.alert(
        'Impossible de supprimer',
        `Cet emplacement contient ${locationContainers.length} container(s) et ${locationItems.length} article(s). Veuillez d'abord les déplacer ou les supprimer.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setConfirmDialog({
      visible: true,
      locationId
    });
  }, [containers, items]);

  // Calculer les statistiques pour chaque emplacement et globales
  const locationsWithStats = locations.map(location => {
    const locationContainers = containers.filter(container => container.locationId === location.id);
    const directItems = items.filter(item => item.locationId === location.id && !item.containerId);
    const containersItems = items.filter(item => 
      item.containerId && locationContainers.some(container => container.id === item.containerId)
    );
    const allLocationItems = [...directItems, ...containersItems];

    return {
      ...location,
      containerCount: locationContainers.length,
      itemCount: allLocationItems.length,
      totalValue: allLocationItems.reduce((sum, item) => sum + (item.sellingPrice || 0), 0),
      availableItems: allLocationItems.filter(item => item.status === 'available').length,
      soldItems: allLocationItems.filter(item => item.status === 'sold').length,
      occupiedContainers: locationContainers.filter(container => 
        items.some(item => item.containerId === container.id)
      ).length,
      emptyContainers: locationContainers.filter(container => 
        !items.some(item => item.containerId === container.id)
      ).length
    };
  });

  // Statistiques globales
  const availableItems = items.filter(item => item.status === 'available');
  const globalStats = {
    totalLocations: locations.length,
    totalContainers: containers.length,
    totalItems: items.length,
    totalValue: items.reduce((sum, item) => sum + (item.sellingPrice || 0), 0),
    // Ne compter que les articles disponibles pour la moyenne
    averageAvailableItemsPerLocation: locations.length > 0 ? availableItems.length / locations.length : 0,
    averageContainersPerLocation: locations.length > 0 ? containers.length / locations.length : 0,
    // Taux d'occupation = pourcentage de containers qui contiennent au moins un article
    occupancyRate: containers.length > 0 ? (containers.filter(container => 
      items.some(item => item.containerId === container.id)
    ).length / containers.length) * 100 : 0,
    mostPopulatedLocation: locationsWithStats.reduce((max, location) => 
      location.itemCount > (max?.itemCount || 0) ? location : max, locationsWithStats[0]),
    highestValueLocation: locationsWithStats.reduce((max, location) => 
      location.totalValue > (max?.totalValue || 0) ? location : max, locationsWithStats[0])
  };

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <CommonHeader
          title="Emplacements"
          onBackPress={() => router.back()}
          rightComponent={
            <TouchableOpacity
              style={headerStyles.headerButton}
              onPress={handleAddLocation}
            >
              <Icon name="add" size={24} color={activeTheme.primary} />
            </TouchableOpacity>
          }
        />
        
        {/* Statistiques globales */}
        {!isLoadingItems && locations.length > 0 && (
          <View style={[styles.card, { margin: 16, marginBottom: 8 }]}>
            <Text style={[styles.title, { marginBottom: 12 }]}>Aperçu général</Text>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 12
            }}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: activeTheme.primary }}>
                  {formatNumberWithSpaces(globalStats.totalValue)}
                </Text>
                <Text style={{ fontSize: 12, color: activeTheme.text.secondary }}>Valeur totale</Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: activeTheme.primary }}>
                  {globalStats.occupancyRate.toFixed(0)}%
                </Text>
                <Text style={{ fontSize: 12, color: activeTheme.text.secondary }}>Taux d'occupation</Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: activeTheme.primary }}>
                  {globalStats.averageAvailableItemsPerLocation.toFixed(1)}
                </Text>
                <Text style={{ fontSize: 12, color: activeTheme.text.secondary }}>Moy. dispo/lieu</Text>
              </View>
            </View>
            {globalStats.mostPopulatedLocation && (
              <View style={{
                backgroundColor: activeTheme.backgroundSecondary,
                padding: 10,
                borderRadius: 6,
                flexDirection: 'row',
                justifyContent: 'space-between'
              }}>
                <Text style={{ fontSize: 13, color: activeTheme.text.secondary }}>
                  Plus peuplé: <Text style={{ fontWeight: '600', color: activeTheme.text.primary }}>
                    {globalStats.mostPopulatedLocation.name} ({globalStats.mostPopulatedLocation.itemCount} articles)
                  </Text>
                </Text>
              </View>
            )}
          </View>
        )}
        
        {isLoadingItems ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={activeTheme.primary} />
            <Text style={styles.loadingText}>Chargement des emplacements...</Text>
          </View>
        ) : (
          <LocationGrid
            locations={locationsWithStats}
            onLocationPress={handleLocationPress}
            onDeleteLocation={handleDeleteLocation}
            onRefresh={handleRefresh}
          />
        )}

        <ConfirmationDialog
          visible={confirmDialog.visible}
          title="Supprimer l'emplacement"
          message="Êtes-vous sûr de vouloir supprimer cet emplacement ? Cette action est irréversible."
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDialog({ visible: false, locationId: null })}
          confirmText="Supprimer"
        />
      </View>
    </ErrorBoundary>
  );
};

export default LocationIndexScreen;