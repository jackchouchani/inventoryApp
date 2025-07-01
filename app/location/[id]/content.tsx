import React, { useCallback } from 'react';
import { View, SafeAreaView, ActivityIndicator, TouchableOpacity, Text, Platform, ScrollView, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../../src/styles/StyleFactory';

// Composants
import VirtualizedItemList from '../../../src/components/VirtualizedItemList';
import { CommonHeader, Icon } from '../../../src/components';
import { ErrorBoundary } from '../../../src/components/ErrorBoundary';

// Hooks et Redux
import { useAllLocations, useAllContainers, useLocationPageData } from '../../../src/hooks/useOptimizedSelectors';
import { useAppTheme } from '../../../src/contexts/ThemeContext';
import type { Item } from '../../../src/types/item';
import type { Container } from '../../../src/types/container';

const LocationContentScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeTheme } = useAppTheme();
  
  const insets = useSafeAreaInsets();
  
  const locations = useAllLocations();
  const allContainers = useAllContainers();
  const location = locations.find(l => l.id === parseInt(id || '0', 10));
  
  // Charger tous les items et containers (sans filtre locationId)
  const { items: allItems, containers, isLoading } = useLocationPageData({
    status: 'all'
  });
  
  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'LocationCard');
  const localStyles = getLocalStyles(activeTheme);

  // Note: useStockActions retiré car non utilisé dans cette vue

  // Filtrer les containers et items de cette location
  const locationContainers = allContainers.filter(container => container.locationId === location?.id);
  const directItems = allItems.filter(item => 
    item.locationId === location?.id && !item.containerId
  );
  const containersItems = allItems.filter(item => 
    item.containerId && locationContainers.some(container => container.id === item.containerId)
  );
  const allLocationItems = [...directItems, ...containersItems];

  // Statistiques enrichies
  const stats = {
    totalValue: allLocationItems.reduce((sum, item) => sum + (item.sellingPrice || 0), 0),
    averageValue: allLocationItems.length > 0 ? allLocationItems.reduce((sum, item) => sum + (item.sellingPrice || 0), 0) / allLocationItems.length : 0,
    availableItems: allLocationItems.filter(item => item.status === 'available').length,
    soldItems: allLocationItems.filter(item => item.status === 'sold').length,
    profitPotential: allLocationItems.reduce((sum, item) => sum + ((item.sellingPrice || 0) - (item.purchasePrice || 0)), 0),
    latestItem: allLocationItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0],
    occupiedContainers: locationContainers.filter(container => 
      allItems.some(item => item.containerId === container.id)
    ).length,
    emptyContainers: locationContainers.filter(container => 
      !allItems.some(item => item.containerId === container.id)
    ).length,
    fullestContainer: locationContainers.reduce((max, container) => {
      const containerItemCount = allItems.filter(item => item.containerId === container.id).length;
      const maxItemCount = allItems.filter(item => item.containerId === max?.id).length || 0;
      return containerItemCount > maxItemCount ? container : max;
    }, locationContainers[0])
  };
  
  console.log('[LocationContent] Debug stats:', {
    locationId: location?.id,
    totalContainers: allContainers.length,
    locationContainers: locationContainers.length,
    totalItems: allItems.length,
    directItems: directItems.length,
    containersItems: containersItems.length,
    allLocationItems: allLocationItems.length
  });

  const handleItemPress = useCallback((item: Item) => {
    // Navigation vers les détails de l'item avec paramètre de retour
    router.push(`/item/${item.id}/info?returnTo=/location/${location?.id}/content`);
  }, [router, location?.id]);

  const handleContainerPress = useCallback((container: Container) => {
    // Navigation vers le contenu du container
    router.push(`/container/${container.id}/content`);
  }, [router]);

  // Note: handleMoveItem supprimé car non utilisé avec la nouvelle version de VirtualizedItemList

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  // État de chargement
  if (isLoading || (!location && locations.length === 0)) {
    return (
      <View style={[styles.loadingContainer, { paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
        <Text style={styles.loadingText}>Chargement de l'emplacement...</Text>
      </View>
    );
  }

  // Emplacement introuvable
  if (!location) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <CommonHeader 
          title="Emplacement Introuvable"
          onBackPress={() => router.back()}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Emplacement non trouvé</Text>
        </View>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={[
        styles.container, 
        Platform.OS === 'web' ? { paddingTop: 0 } : {}
      ]}>
        {/* Header avec bouton Edit */}
        <CommonHeader 
          title={location.name}
          onBackPress={handleClose}
          rightComponent={
            <TouchableOpacity 
              style={[styles.actionButton]}
              onPress={() => router.push(`/location/${location.id}/edit`)}
            >
              <Icon name="edit" size={20} color={activeTheme.primary} />
              <Text style={{ color: activeTheme.primary, marginLeft: 4, fontSize: 14 }}>
                Éditer
              </Text>
            </TouchableOpacity>
          }
        />
        
        <ScrollView style={localStyles.scrollContainer}>
          {/* Détails de l'emplacement */}
          <View style={[styles.card, localStyles.infoCard]}>
            <Text style={styles.title}>{location.name}</Text>
            {location.address && (
              <Text style={styles.address}>📍 {location.address}</Text>
            )}
            {location.description && (
              <Text style={styles.description}>{location.description}</Text>
            )}
            
            {/* Statistiques principales */}
            <View style={[styles.footer, localStyles.statsContainer]}>
              <View style={localStyles.statItem}>
                <Text style={localStyles.statNumber}>{locationContainers.length}</Text>
                <Text style={localStyles.statLabel}>Container(s)</Text>
              </View>
              <View style={localStyles.statItem}>
                <Text style={localStyles.statNumber}>{allLocationItems.length}</Text>
                <Text style={localStyles.statLabel}>Total articles</Text>
              </View>
              <View style={localStyles.statItem}>
                <Text style={localStyles.statNumber}>{stats.totalValue.toFixed(0)}€</Text>
                <Text style={localStyles.statLabel}>Valeur totale</Text>
              </View>
            </View>

            {/* Statistiques détaillées */}
            <View style={[localStyles.detailedStatsContainer]}>
              <View style={localStyles.detailedStatsRow}>
                <View style={localStyles.detailedStatItem}>
                  <Icon name="inventory" size={16} color={activeTheme.success} />
                  <Text style={localStyles.detailedStatText}>{stats.availableItems} disponibles</Text>
                </View>
                <View style={localStyles.detailedStatItem}>
                  <Icon name="shopping_cart" size={16} color={activeTheme.warning} />
                  <Text style={localStyles.detailedStatText}>{stats.soldItems} vendus</Text>
                </View>
              </View>
              <View style={localStyles.detailedStatsRow}>
                <View style={localStyles.detailedStatItem}>
                  <Icon name="inbox" size={16} color={activeTheme.primary} />
                  <Text style={localStyles.detailedStatText}>{stats.occupiedContainers}/{locationContainers.length} containers utilisés</Text>
                </View>
                <View style={localStyles.detailedStatItem}>
                  <Icon name="trending_up" size={16} color={activeTheme.success} />
                  <Text style={localStyles.detailedStatText}>{stats.averageValue.toFixed(0)}€ moy/article</Text>
                </View>
              </View>
              {stats.latestItem && (
                <View style={localStyles.detailedStatsRow}>
                  <View style={[localStyles.detailedStatItem, { flex: 1 }]}>
                    <Icon name="schedule" size={16} color={activeTheme.text.secondary} />
                    <Text style={localStyles.detailedStatText}>
                      Dernier ajout: {stats.latestItem.name}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Section de gestion des containers */}
          <View style={[styles.card, localStyles.sectionCard]}>
            <View style={localStyles.sectionHeader}>
              <Text style={styles.title}>Containers ({locationContainers.length})</Text>
              <TouchableOpacity
                style={localStyles.addButton}
                onPress={() => router.push(`/container/assign-location?locationId=${location.id}`)}
              >
                <Icon name="add" size={20} color={activeTheme.primary} />
                <Text style={[localStyles.addButtonText, { color: activeTheme.primary }]}>
                  Assigner
                </Text>
              </TouchableOpacity>
            </View>
            
            {locationContainers.length > 0 ? (
              locationContainers.map((container) => {
                const containerItems = allItems.filter(item => item.containerId === container.id);
                return (
                  <TouchableOpacity
                    key={container.id}
                    style={localStyles.containerItem}
                    onPress={() => handleContainerPress(container)}
                  >
                    <View style={localStyles.containerIcon}>
                      <Icon name="inbox" size={24} color={activeTheme.primary} />
                    </View>
                    <View style={localStyles.containerInfo}>
                      <Text style={localStyles.containerName}>
                        {container.name} #{container.number}
                      </Text>
                      <Text style={localStyles.containerSubtext}>
                        {containerItems.length} article(s)
                      </Text>
                    </View>
                    <Icon name="chevron_right" size={20} color={activeTheme.text.secondary} />
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={localStyles.emptyContainer}>
                <Icon name="inbox" size={48} color={activeTheme.text.disabled} />
                <Text style={localStyles.emptyText}>
                  Aucun container assigné
                </Text>
                <Text style={localStyles.emptySubtext}>
                  Utilisez le bouton "Assigner" pour ajouter des containers
                </Text>
              </View>
            )}
          </View>

          {/* Liste des articles directs (sans container) */}
          {directItems.length > 0 && (
            <View style={[styles.card, localStyles.sectionCard]}>
              <Text style={styles.title}>Articles directs ({directItems.length})</Text>
              <VirtualizedItemList
                items={directItems}
                estimatedItemSize={120}
                onItemPress={handleItemPress}
                containers={allContainers}
                categories={[]}
              />
            </View>
          )}

          {/* Message si emplacement vide */}
          {allLocationItems.length === 0 && locationContainers.length === 0 && (
            <View style={[styles.card, localStyles.emptyLocationCard]}>
              <View style={localStyles.emptyLocationContainer}>
                <Icon name="location_on" size={64} color={activeTheme.text.disabled} />
                <Text style={localStyles.emptyLocationTitle}>Emplacement vide</Text>
                <Text style={localStyles.emptyLocationSubtext}>
                  Cet emplacement ne contient encore aucun container ni article.{'\n'}
                  Commencez par assigner des containers ou ajouter des articles directement.
                </Text>
                <TouchableOpacity
                  style={localStyles.primaryButton}
                  onPress={() => router.push(`/container/assign-location?locationId=${location.id}`)}
                >
                  <Icon name="add" size={20} color={activeTheme.text.onPrimary} />
                  <Text style={localStyles.primaryButtonText}>Assigner des containers</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
  },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  statsContainer: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.primary}15`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${theme.primary}30`,
  },
  addButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
  },
  containerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  containerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  containerInfo: {
    flex: 1,
  },
  containerName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text.primary,
    marginBottom: 2,
  },
  containerSubtext: {
    fontSize: 13,
    color: theme.text.secondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 16,
    color: theme.text.secondary,
    marginTop: 8,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyLocationCard: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  emptyLocationContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyLocationTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyLocationSubtext: {
    fontSize: 14,
    color: theme.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
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
  primaryButtonText: {
    color: theme.text.onPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  detailedStatsContainer: {
    backgroundColor: theme.background,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  detailedStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailedStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  detailedStatText: {
    fontSize: 13,
    color: theme.text.secondary,
    marginLeft: 6,
    fontWeight: '500',
  },
});

export default LocationContentScreen;