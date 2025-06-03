import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TextInput, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Icon } from './Icon';
import CommonHeader from './CommonHeader';
import { useAppTheme } from '../contexts/ThemeContext';
import type { Item } from '../types/item';
import type { Container } from '../types/container';
import { getImageUrl } from '../utils/r2Client';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../styles/StyleFactory';

// ✅ HOOKS OPTIMISÉS pour charger TOUS les items
import { useContainerPageData } from '../hooks/useOptimizedSelectors';

interface ContainerContentsProps {
  container: Container;
  containers?: Container[];
  onItemPress: (item: Item) => void;
  onMoveItem: (itemId: number, newContainerId: number | null) => void;
  onClose?: () => void;
  showHeader?: boolean;
}

export const ContainerContents: React.FC<ContainerContentsProps> = ({
  container,
  onItemPress,
  onMoveItem,
  onClose,
  showHeader,
}) => {
  const { activeTheme } = useAppTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('Tous');

  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ContainerContents');

  // ✅ CHARGER TOUS LES ITEMS avec le hook optimisé
  const {
    items: allItems,
    categories,
    containers: allContainers,
    isLoading,
    error
  } = useContainerPageData({
    status: 'all', // Tous les statuts pour avoir la liste complète
  });

  console.log(`[ContainerContents] TOTAL items chargés: ${allItems.length}`);
  console.log(`[ContainerContents] Containers disponibles:`, allContainers.map(c => ({ id: c.id, name: c.name, number: c.number })));

  // Séparer les articles : dans ce container vs disponibles
  const { assignedItems, availableItems } = useMemo(() => {
    const assigned = allItems.filter(item => 
      item.containerId === container.id && item.status === 'available'
    );
    
    // TOUS les items disponibles SAUF ceux dans CE container spécifique
    // Inclut les items sans container ET ceux dans d'autres containers
    const available = allItems.filter(item => 
      item.containerId !== container.id && item.status === 'available'
    );
    
    // Trier les disponibles : sans container en premier, puis les autres par container
    const sortedAvailable = available.sort((a, b) => {
      // Items sans container en premier
      if (!a.containerId && b.containerId) return -1;
      if (a.containerId && !b.containerId) return 1;
      
      // Si les deux ont des containers, trier par ID container
      if (a.containerId && b.containerId) {
        return a.containerId - b.containerId;
      }
      
      return 0;
    });
    
    return {
      assignedItems: assigned,
      availableItems: sortedAvailable
    };
  }, [allItems, container.id]);

  // Filtrer les articles disponibles selon la recherche ET la catégorie
  const filteredAvailableItems = useMemo(() => {
    return availableItems.filter(item => {
      const matchesSearch = searchQuery.trim() === '' || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Filtrer par catégorie sélectionnée
      let matchesFilter = true;
      if (selectedFilter !== 'Tous') {
        // Trouver la catégorie de l'item
        const itemCategory = categories.find(cat => cat.id === item.categoryId);
        if (itemCategory) {
          // Vérifier si le nom de la catégorie correspond au filtre
          matchesFilter = itemCategory.name === selectedFilter || 
                         itemCategory.name.toLowerCase().includes(selectedFilter.toLowerCase());
        } else {
          // Si l'item n'a pas de catégorie, il ne match que si on cherche les non-catégorisés
          matchesFilter = false;
        }
      }
      
      return matchesSearch && matchesFilter;
    });
  }, [availableItems, searchQuery, selectedFilter, categories]);

  const handleRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      // Le hook stockPageData gère automatiquement le rechargement
    } catch (err) {
      console.error('Erreur lors du rafraîchissement:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleMoveToContainer = useCallback((itemId: number) => {
    // Cet item sera déplacé vers ce container
    // Si l'item était dans un autre container, ça fera un changement de container
    onMoveItem(itemId, container.id);
  }, [onMoveItem, container.id]);

  const handleRemoveFromContainer = useCallback((itemId: number) => {
    onMoveItem(itemId, null);
  }, [onMoveItem]);

  const getContainerLabel = useCallback((containerId: number | null) => {
    if (!containerId) return 'Sans container';
    
    // Utiliser allContainers du hook optimisé
    const foundContainer = allContainers.find(c => c.id === containerId);
    
    if (foundContainer) {
      const label = `${foundContainer.name} #${foundContainer.number}`;
      return label;
    }
    
    return `Container #${containerId}`;
  }, [allContainers]);

  const renderAssignedItem = useCallback(({ item }: { item: Item }) => (
    <View style={styles.articleCard}>
      {/* Image de l'article */}
      {item.photo_storage_url && (
        <View style={styles.articleImageContainer}>
          <Image 
            source={{ uri: getImageUrl(item.photo_storage_url) }} 
            style={styles.articleImage}
            resizeMode="cover"
          />
        </View>
      )}
      
      <View style={styles.articleContent}>
        <Text style={styles.articleName}>{item.name}</Text>
        
        {/* Description si disponible */}
        {item.description && (
          <Text style={styles.articleDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        
        <View style={styles.articleTags}>
          <View style={styles.articleTag}>
            <Text style={styles.articleTagText}>
              {categories.find(cat => cat.id === item.categoryId)?.name || 'Non catégorisé'}
            </Text>
          </View>
          <View style={[styles.articleTag, styles.articleTagContainer]}>
            <Text style={styles.articleTagContainerText}>{container.name} #{container.number}</Text>
          </View>
        </View>
        
        <Text style={styles.articlePrice}>
          {item.sellingPrice ? `${item.sellingPrice}€` : 'Prix non défini'}
        </Text>
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.actionIcon, styles.infoIcon]}
          onPress={() => onItemPress(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="info" size={14} color={activeTheme.text.secondary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionIcon, styles.removeIcon]}
          onPress={() => handleRemoveFromContainer(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="remove" size={16} color={activeTheme.danger.main} />
        </TouchableOpacity>
      </View>
    </View>
  ), [container, styles, activeTheme.danger.main, activeTheme.text.secondary, handleRemoveFromContainer, onItemPress, categories]);

  const renderAvailableItem = useCallback(({ item }: { item: Item }) => {
    return (
      <View style={styles.articleCard}>
        {/* Image de l'article */}
        {item.photo_storage_url && (
          <View style={styles.articleImageContainer}>
            <Image 
              source={{ uri: getImageUrl(item.photo_storage_url) }} 
              style={styles.articleImage}
              resizeMode="cover"
            />
          </View>
        )}
        
        <View style={styles.articleContent}>
          <Text style={styles.articleName}>{item.name}</Text>
          
          {/* Description si disponible */}
          {item.description && (
            <Text style={styles.articleDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          
          <View style={styles.articleTags}>
            <View style={styles.articleTag}>
              <Text style={styles.articleTagText}>
                {categories.find(cat => cat.id === item.categoryId)?.name || 'Non catégorisé'}
              </Text>
            </View>
            {item.containerId ? (
              <View style={[styles.articleTag, styles.articleTagOtherContainer]}>
                <Text style={styles.articleTagOtherContainerText}>{getContainerLabel(item.containerId)}</Text>
              </View>
            ) : (
              <View style={[styles.articleTag, styles.noContainerTag]}>
                <Text style={styles.noContainerTagText}>Sans container</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.articlePrice}>
            {item.sellingPrice ? `${item.sellingPrice}€` : 'Prix non défini'}
          </Text>
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionIcon, styles.infoIcon]}
            onPress={() => onItemPress(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="info" size={14} color={activeTheme.text.secondary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionIcon, styles.addIcon]}
            onPress={() => handleMoveToContainer(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="add" size={16} color={activeTheme.success} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [styles, activeTheme.success, activeTheme.text.secondary, getContainerLabel, handleMoveToContainer, onItemPress, categories]);

  // Générer la liste des catégories dynamiquement
  const filterCategories = useMemo(() => {
    const uniqueCategories = ['Tous'];
    
    // Ajouter les catégories uniques des items disponibles
    categories.forEach(category => {
      if (!uniqueCategories.includes(category.name)) {
        uniqueCategories.push(category.name);
      }
    });
    
    return uniqueCategories;
  }, [categories]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { color: activeTheme.danger.main }]}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ✅ COMMONHEADER - Header standardisé */}
      {showHeader && (
        <CommonHeader 
          title={`${container.name} #${container.number}`}
          onBackPress={onClose}
          rightComponent={
            <View style={styles.containerActions}>
              <TouchableOpacity style={[styles.headerActionButton, styles.editButton]}>
                <Icon name="edit" size={20} color={activeTheme.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerActionButton, styles.deleteButton]}>
                <Icon name="delete" size={20} color={activeTheme.danger.main} />
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Description container */}
      <View style={styles.containerMeta}>
        <Text style={styles.containerSubtitle}>Description: {container.description}</Text>
      </View>

      {/* Layout responsive - deux colonnes sur grand écran, empilé sur mobile */}
      <View style={styles.columnsContainer}>
        {/* SECTION 1 : Articles assignés */}
        <View style={styles.columnWrapper}>
          <View style={styles.columnHeader}>
            <Text style={styles.columnTitle}>Articles assignés ({assignedItems.length})</Text>
          </View>
          <View style={styles.listContainer}>
            <FlatList
              data={assignedItems}
              renderItem={renderAssignedItem}
              keyExtractor={(item) => `assigned-${item.id}`}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  colors={[activeTheme.primary]}
                />
              }
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Aucun article assigné</Text>
                </View>
              )}
            />
          </View>
        </View>

        {/* SECTION 2 : Articles disponibles avec recherche */}
        <View style={styles.columnWrapper}>
          <View style={styles.columnHeader}>
            <Text style={styles.columnTitle}>Articles disponibles ({filteredAvailableItems.length})</Text>
          </View>
          
          {/* Barre de recherche seulement sur section 2 */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <Icon name="search" size={20} color={activeTheme.text.secondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un article..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={activeTheme.text.secondary}
              />
            </View>
          </View>

          {/* Filtres par catégorie seulement sur section 2 */}
          <View style={styles.filtersContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersScrollView}
            >
              {filterCategories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.filterPill,
                    selectedFilter === category && styles.filterPillActive
                  ]}
                  onPress={() => setSelectedFilter(category)}
                >
                  <Text style={[
                    styles.filterPillText,
                    selectedFilter === category && styles.filterPillTextActive
                  ]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          <View style={styles.listContainer}>
            <FlatList
              data={filteredAvailableItems}
              renderItem={renderAvailableItem}
              keyExtractor={(item) => `available-${item.id}`}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Aucun article disponible</Text>
                </View>
              )}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

ContainerContents.displayName = 'ContainerContents'; 