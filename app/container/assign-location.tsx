import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useDispatch } from 'react-redux';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../src/styles/StyleFactory';
import { StyleSheet, Platform } from 'react-native';

// Composants
import { CommonHeader, Icon } from '../../src/components';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

// Hooks et Redux
import { useAllContainers, useAllLocations } from '../../src/hooks/useOptimizedSelectors';
import { useContainersOptimized } from '../../src/hooks/useContainersOptimized';
import { useAppTheme } from '../../src/contexts/ThemeContext';
import { AppDispatch } from '../../src/store/store';
import { updateContainer } from '../../src/store/containersThunks';
import type { Container } from '../../src/types/container';

const AssignContainerToLocationScreen = () => {
  const router = useRouter();
  const { locationId } = useLocalSearchParams<{ locationId: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { activeTheme } = useAppTheme();
  
  const [selectedContainers, setSelectedContainers] = useState<Set<number>>(new Set());
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Charger les données
  useContainersOptimized();
  const allContainers = useAllContainers();
  const allLocations = useAllLocations();
  
  const location = allLocations.find(l => l.id === parseInt(locationId || '0', 10));
  
  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ContainerCard');
  const localStyles = getLocalStyles(activeTheme);
  
  // Filtrer les containers disponibles (sans emplacement ou avec un autre emplacement)
  const availableContainers = useMemo(() => {
    return allContainers.filter(container => 
      container.locationId !== parseInt(locationId || '0', 10)
    );
  }, [allContainers, locationId]);
  
  const containersInLocation = useMemo(() => {
    return allContainers.filter(container => 
      container.locationId === parseInt(locationId || '0', 10)
    );
  }, [allContainers, locationId]);
  
  // Statistiques pour cette page (définies après les dépendances)
  const assignmentStats = {
    totalContainersInLocation: containersInLocation.length,
    availableContainers: availableContainers.length,
    totalContainers: allContainers.length,
    occupancyRate: allContainers.length > 0 ? 
      (containersInLocation.length / allContainers.length) * 100 : 0
  };
  
  const handleContainerToggle = useCallback((containerId: number) => {
    setSelectedContainers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(containerId)) {
        newSet.delete(containerId);
      } else {
        newSet.add(containerId);
      }
      return newSet;
    });
  }, []);
  
  const handleAssignContainers = useCallback(async () => {
    if (selectedContainers.size === 0) {
      Alert.alert('Aucune sélection', 'Veuillez sélectionner au moins un container à assigner.');
      return;
    }
    
    setIsAssigning(true);
    
    try {
      const promises = Array.from(selectedContainers).map(containerId =>
        dispatch(updateContainer({
          id: containerId,
          updates: { locationId: parseInt(locationId || '0', 10) }
        })).unwrap()
      );
      
      await Promise.all(promises);
      
      Alert.alert(
        'Succès',
        `${selectedContainers.size} container(s) assigné(s) à ${location?.name}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Erreur lors de l\'assignation:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'assignation des containers.');
    } finally {
      setIsAssigning(false);
    }
  }, [selectedContainers, locationId, location?.name, dispatch, router]);
  
  const handleRemoveFromLocation = useCallback(async (containerId: number) => {
    try {
      await dispatch(updateContainer({
        id: containerId,
        updates: { locationId: null }
      })).unwrap();
      
      Alert.alert('Succès', 'Container retiré de l\'emplacement');
    } catch (error) {
      console.error('Erreur lors du retrait:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors du retrait du container.');
    }
  }, [dispatch]);
  
  const renderContainerItem = useCallback(({ item: container }: { item: Container }) => {
    const isSelected = selectedContainers.has(container.id);
    const isInCurrentLocation = container.locationId === parseInt(locationId || '0', 10);
    
    return (
      <TouchableOpacity
        style={[
          localStyles.containerItem,
          isSelected && localStyles.selectedContainer,
          isInCurrentLocation && localStyles.currentLocationContainer
        ]}
        onPress={() => !isInCurrentLocation && handleContainerToggle(container.id)}
        disabled={isInCurrentLocation}
      >
        <View style={localStyles.containerIcon}>
          <Icon 
            name="inbox" 
            size={24} 
            color={isInCurrentLocation ? activeTheme.success : isSelected ? activeTheme.primary : activeTheme.text.secondary} 
          />
        </View>
        
        <View style={localStyles.containerInfo}>
          <Text style={[
            localStyles.containerName,
            isSelected && { color: activeTheme.primary },
            isInCurrentLocation && { color: activeTheme.success }
          ]}>
            {container.name} #{container.number}
          </Text>
          <Text style={[
            localStyles.containerStatus,
            isInCurrentLocation && { color: activeTheme.success }
          ]}>
            {isInCurrentLocation ? `✓ Déjà dans ${location?.name}` : 
             container.locationId ? '📍 Dans un autre emplacement' : '📭 Sans emplacement'}
          </Text>
        </View>
        
        {isInCurrentLocation ? (
          <TouchableOpacity
            style={localStyles.removeButton}
            onPress={() => handleRemoveFromLocation(container.id)}
          >
            <Icon name="remove" size={20} color={activeTheme.error} />
          </TouchableOpacity>
        ) : (
          <View style={[
            localStyles.checkbox, 
            isSelected && localStyles.checkboxSelected
          ]}>
            {isSelected && <Icon name="check" size={16} color={activeTheme.text.onPrimary} />}
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedContainers, locationId, location?.name, activeTheme, styles, handleContainerToggle, handleRemoveFromLocation]);
  
  if (!location) {
    return (
      <SafeAreaView style={styles.container}>
        <CommonHeader
          title="Emplacement introuvable"
          onBackPress={() => router.back()}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Emplacement non trouvé</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <CommonHeader
          title={`Assigner à ${location.name}`}
          onBackPress={() => router.back()}
          rightComponent={
            selectedContainers.size > 0 ? (
              <TouchableOpacity
                style={localStyles.assignButton}
                onPress={handleAssignContainers}
                disabled={isAssigning}
              >
                {isAssigning ? (
                  <ActivityIndicator size="small" color={activeTheme.text.onPrimary} />
                ) : (
                  <>
                    <Icon name="check" size={18} color={activeTheme.text.onPrimary} />
                    <Text style={localStyles.assignButtonText}>
                      Assigner ({selectedContainers.size})
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null
          }
        />
        
        {/* Statistiques d'assignation */}
        <View style={[localStyles.statsCard]}>
          <View style={localStyles.statsRow}>
            <View style={localStyles.statItem}>
              <Text style={localStyles.statNumber}>{assignmentStats.totalContainersInLocation}</Text>
              <Text style={localStyles.statLabel}>Déjà assignés</Text>
            </View>
            <View style={localStyles.statItem}>
              <Text style={localStyles.statNumber}>{assignmentStats.availableContainers}</Text>
              <Text style={localStyles.statLabel}>Disponibles</Text>
            </View>
            <View style={localStyles.statItem}>
              <Text style={localStyles.statNumber}>
                {assignmentStats.totalContainers > 0 
                  ? `${((assignmentStats.totalContainersInLocation / assignmentStats.totalContainers) * 100).toFixed(0)}%`
                  : '0%'}
              </Text>
              <Text style={localStyles.statLabel}>Taux d'occupation</Text>
            </View>
          </View>
        </View>
        
        <ScrollView style={localStyles.scrollContainer}>
          {/* Containers déjà dans cet emplacement */}
          {containersInLocation.length > 0 && (
            <View style={localStyles.section}>
              <View style={localStyles.sectionHeader}>
                <Icon name="location_on" size={20} color={activeTheme.success} />
                <Text style={localStyles.sectionTitle}>
                  Containers dans cet emplacement ({containersInLocation.length})
                </Text>
              </View>
              <FlatList
                data={containersInLocation}
                renderItem={renderContainerItem}
                keyExtractor={(item) => `current-${item.id}`}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={localStyles.separator} />}
              />
            </View>
          )}
          
          {/* Containers disponibles */}
          <View style={localStyles.section}>
            <View style={localStyles.sectionHeader}>
              <Icon name="inbox" size={20} color={activeTheme.primary} />
              <Text style={localStyles.sectionTitle}>
                Containers disponibles ({availableContainers.length})
              </Text>
            </View>
            {availableContainers.length > 0 ? (
              <FlatList
                data={availableContainers}
                renderItem={renderContainerItem}
                keyExtractor={(item) => `available-${item.id}`}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={localStyles.separator} />}
              />
            ) : (
              <View style={localStyles.emptyContainer}>
                <Icon name="inbox" size={48} color={activeTheme.text.disabled} />
                <Text style={localStyles.emptyText}>
                  Aucun container disponible
                </Text>
                <Text style={localStyles.emptySubtext}>
                  Tous les containers sont déjà assignés à des emplacements
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
};

// Styles locaux pour les éléments spécifiques à cette page
const getLocalStyles = (theme: any) => StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text.primary,
    marginLeft: 8,
    flex: 1,
  },
  containerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  selectedContainer: {
    borderColor: theme.primary,
    backgroundColor: `${theme.primary}08`,
    ...Platform.select({
      ios: {
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: `0px 2px 4px ${theme.primary}40`,
      },
    }),
  },
  currentLocationContainer: {
    borderColor: theme.success,
    backgroundColor: `${theme.success}08`,
  },
  containerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  containerInfo: {
    flex: 1,
  },
  containerName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text.primary,
    marginBottom: 4,
  },
  containerStatus: {
    fontSize: 13,
    color: theme.text.secondary,
    fontStyle: 'italic',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${theme.error}15`,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${theme.error}30`,
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  assignButtonText: {
    color: theme.text.onPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  separator: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.text.secondary,
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.text.secondary,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
  statsCard: {
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.text.secondary,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default AssignContainerToLocationScreen;