import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './store';
import { itemsAdapter } from './itemsAdapter';
import { categoriesAdapter } from './categorySlice';
import { containersAdapter } from './containersSlice';
import { locationsAdapter } from './locationsSlice';
import { sourcesAdapter_ } from './sourcesSlice';
import type { Item } from '../types/item';
import type { Category } from '../types/category';
import type { Container } from '../types/container';
import type { Location } from '../types/location';
import type { Source } from '../types/source';

// Sélecteurs de base optimisés
export const selectItemsState = (state: RootState) => state.items;
export const selectCategoriesState = (state: RootState) => state.categories;
export const selectContainersState = (state: RootState) => state.containers;
export const selectLocationsState = (state: RootState) => state.locations;
export const selectSourcesState = (state: RootState) => state.sources;

// Sélecteurs d'entités avec adaptateurs
export const {
  selectAll: selectAllItems,
  selectById: selectItemById,
  selectIds: selectItemIds,
  selectEntities: selectItemEntities,
  selectTotal: selectTotalItems,
} = itemsAdapter.getSelectors(selectItemsState);

export const {
  selectAll: selectAllCategories,
  selectById: selectCategoryById,
  selectEntities: selectCategoryEntities,
} = categoriesAdapter.getSelectors(selectCategoriesState);

export const {
  selectAll: selectAllContainers,
  selectById: selectContainerById,
  selectEntities: selectContainerEntities,
} = containersAdapter.getSelectors(selectContainersState);

export const {
  selectAll: selectAllLocations,
  selectById: selectLocationById,
  selectEntities: selectLocationEntities,
} = locationsAdapter.getSelectors(selectLocationsState);

export const {
  selectAll: selectAllSources,
  selectById: selectSourceById,
  selectEntities: selectSourceEntities,
} = sourcesAdapter_.getSelectors((state: RootState) => state.sources.sources);

// Interface pour les filtres
export interface ItemFilters {
  status?: 'all' | 'available' | 'sold';
  categoryId?: number;
  containerId?: number;
  locationId?: number;
  sourceId?: number;
  minPrice?: number;
  maxPrice?: number;
  searchQuery?: string;
}

// Sélecteur mémoïsé pour filtrer et trier les items
export const selectFilteredItems = createSelector(
  [selectAllItems, (_state: RootState, filters: ItemFilters) => filters],
  (items, filters) => {
    if (!filters || Object.keys(filters).length === 0) {
      return items;
    }

    const filteredItems = items.filter((item: Item) => {
      // Filtre par statut
      if (filters.status && filters.status !== 'all' && item.status !== filters.status) {
        return false;
      }

      // Filtre par catégorie
      if (filters.categoryId && item.categoryId !== filters.categoryId) {
        return false;
      }

      // Filtre par container
      if (filters.containerId && item.containerId !== filters.containerId) {
        return false;
      }

      // Filtre par emplacement
      if (filters.locationId && item.locationId !== filters.locationId) {
        return false;
      }

      // Filtre par source
      if (filters.sourceId && item.sourceId !== filters.sourceId) {
        return false;
      }

      // Filtre par prix minimum
      if (filters.minPrice !== undefined && item.sellingPrice < filters.minPrice) {
        return false;
      }

      // Filtre par prix maximum
      if (filters.maxPrice !== undefined && item.sellingPrice > filters.maxPrice) {
        return false;
      }

      // Filtre par recherche textuelle
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(query);
        const descriptionMatch = item.description?.toLowerCase().includes(query);
        if (!nameMatch && !descriptionMatch) {
          return false;
        }
      }

      return true;
    });

    // Tri spécial pour les items vendus : tri par date de vente (plus récent en premier)
    if (filters.status === 'sold') {
      return filteredItems.sort((a, b) => {
        // Si un item n'a pas de soldAt, le mettre à la fin
        if (!a.soldAt && !b.soldAt) return 0;
        if (!a.soldAt) return 1;
        if (!b.soldAt) return -1;
        
        // Tri décroissant : date la plus récente en premier
        return new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime();
      });
    }

    return filteredItems;
  }
);

// Sélecteur mémoïsé pour les items avec leurs relations
export const selectItemsWithRelations = createSelector(
  [selectFilteredItems, selectCategoryEntities, selectContainerEntities, selectLocationEntities],
  (items, categories, containers, locations) => {
    return items.map((item: Item) => ({
      ...item,
      category: item.categoryId ? categories[item.categoryId] : undefined,
      container: item.containerId ? containers[item.containerId] : undefined,
      location: item.locationId ? locations[item.locationId] : undefined,
    }));
  }
);

// Sélecteur mémoïsé pour les statistiques d'items
export const selectItemStats = createSelector(
  [selectAllItems],
  (items) => {
    const stats = {
      total: items.length,
      available: 0,
      sold: 0,
      totalValue: 0,
      soldValue: 0,
      avgPrice: 0,
    };

    items.forEach((item: Item) => {
      if (item.status === 'available') {
        stats.available++;
        stats.totalValue += item.sellingPrice || 0;
      } else if (item.status === 'sold') {
        stats.sold++;
        stats.soldValue += item.sellingPrice || 0;
      }
    });

    stats.avgPrice = stats.total > 0 ? stats.totalValue / stats.total : 0;

    return stats;
  }
);

// Sélecteur mémoïsé pour les items par catégorie
export const selectItemsByCategory = createSelector(
  [selectAllItems, selectAllCategories],
  (items, categories) => {
    const itemsByCategory = new Map<number, { category: Category; items: Item[]; count: number }>();

    categories.forEach((category: Category) => {
      itemsByCategory.set(category.id, {
        category,
        items: [],
        count: 0,
      });
    });

    items.forEach((item: Item) => {
      if (item.categoryId && itemsByCategory.has(item.categoryId)) {
        const categoryData = itemsByCategory.get(item.categoryId)!;
        categoryData.items.push(item);
        categoryData.count++;
      }
    });

    return Array.from(itemsByCategory.values()).filter(data => data.count > 0);
  }
);

// Sélecteur mémoïsé pour les items par container
export const selectItemsByContainer = createSelector(
  [selectAllItems, selectAllContainers],
  (items, containers) => {
    const itemsByContainer = new Map<number, { container: Container; items: Item[]; count: number }>();

    containers.forEach((container: Container) => {
      itemsByContainer.set(container.id, {
        container,
        items: [],
        count: 0,
      });
    });

    items.forEach((item: Item) => {
      if (item.containerId && itemsByContainer.has(item.containerId)) {
        const containerData = itemsByContainer.get(item.containerId)!;
        containerData.items.push(item);
        containerData.count++;
      }
    });

    return Array.from(itemsByContainer.values()).filter(data => data.count > 0);
  }
);

// Sélecteur mémoïsé pour les items par emplacement
export const selectItemsByLocation = createSelector(
  [selectAllItems, selectAllLocations],
  (items, locations) => {
    const itemsByLocation = new Map<number, { location: Location; items: Item[]; count: number }>();

    locations.forEach((location: Location) => {
      itemsByLocation.set(location.id, {
        location,
        items: [],
        count: 0,
      });
    });

    items.forEach((item: Item) => {
      if (item.locationId && itemsByLocation.has(item.locationId)) {
        const locationData = itemsByLocation.get(item.locationId)!;
        locationData.items.push(item);
        locationData.count++;
      }
    });

    return Array.from(itemsByLocation.values()).filter(data => data.count > 0);
  }
);

// Sélecteur mémoïsé pour les containers par emplacement
export const selectContainersByLocation = createSelector(
  [selectAllContainers, selectAllLocations],
  (containers, locations) => {
    const containersByLocation = new Map<number, { location: Location; containers: Container[]; count: number }>();

    locations.forEach((location: Location) => {
      containersByLocation.set(location.id, {
        location,
        containers: [],
        count: 0,
      });
    });

    containers.forEach((container: Container) => {
      if (container.locationId && containersByLocation.has(container.locationId)) {
        const locationData = containersByLocation.get(container.locationId)!;
        locationData.containers.push(container);
        locationData.count++;
      }
    });

    return Array.from(containersByLocation.values()).filter(data => data.count > 0);
  }
);

// Sélecteur pour la recherche optimisée
export const selectSearchResults = createSelector(
  [selectItemsState],
  (itemsState) => itemsState.searchResults
);

// Sélecteur pour l'item sélectionné
export const selectSelectedItem = createSelector(
  [selectItemsState],
  (itemsState) => itemsState.selectedItem
);

// Sélecteur pour les items similaires
export const selectSimilarItems = createSelector(
  [selectItemsState],
  (itemsState) => itemsState.similarItems
);

// Sélecteur pour le statut de chargement
export const selectItemsLoading = createSelector(
  [selectItemsState],
  (itemsState) => itemsState.status === 'loading'
);

// Sélecteur pour les erreurs
export const selectItemsError = createSelector(
  [selectItemsState],
  (itemsState) => itemsState.error
);

// Sélecteur pour la pagination
export const selectPaginationInfo = createSelector(
  [selectItemsState],
  (itemsState) => ({
    currentPage: itemsState.currentPage,
    totalItems: itemsState.totalItems,
    hasMore: itemsState.hasMore,
  })
);

// ===== NOUVEAUX SÉLECTEURS POUR LES SOURCES =====

// Interface pour les statistiques d'une source
export interface SourcePerformance {
  sourceId: number;
  sourceName: string;
  totalItems: number;
  soldItems: number;
  availableItems: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  averageRoi: number;
  averageMargin: number;
  averageDaysToSell: number;
}

// Sélecteur pour la performance des sources
export const selectSourcePerformance = createSelector(
  [selectAllItems, selectAllSources],
  (items, sources): SourcePerformance[] => {
    const sourceMap = new Map(sources.map(source => [source.id, source]));
    const performanceMap = new Map<number, SourcePerformance>();

    // Initialiser toutes les sources
    sources.forEach(source => {
      performanceMap.set(source.id, {
        sourceId: source.id,
        sourceName: source.name,
        totalItems: 0,
        soldItems: 0,
        availableItems: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        averageRoi: 0,
        averageMargin: 0,
        averageDaysToSell: 0,
      });
    });

    // Calculer les stats pour chaque item
    items.forEach(item => {
      if (!item.sourceId) return;

      const performance = performanceMap.get(item.sourceId);
      if (!performance) return;

      performance.totalItems++;
      performance.totalCost += item.purchasePrice;

      if (item.status === 'sold') {
        performance.soldItems++;
        performance.totalRevenue += item.sellingPrice;
        // 🆕 NOUVELLE LOGIQUE PROFIT pour sources
        if (item.isConsignment) {
          performance.totalProfit += (item.consignmentCommission || 0);
        } else {
          performance.totalProfit += (item.sellingPrice - item.purchasePrice);
        }
      } else {
        performance.availableItems++;
      }
    });

    // Calculer les moyennes
    return Array.from(performanceMap.values()).map(performance => {
      if (performance.soldItems > 0) {
        performance.averageRoi = (performance.totalProfit / performance.totalCost) * 100;
        performance.averageMargin = ((performance.totalRevenue - performance.totalCost) / performance.totalRevenue) * 100;
        
        // Calculer le temps moyen de vente (approximation)
        const soldItems = items.filter(item => 
          item.sourceId === performance.sourceId && 
          item.status === 'sold' && 
          item.soldAt && 
          item.createdAt
        );
        
        if (soldItems.length > 0) {
          const totalDays = soldItems.reduce((sum, item) => {
            const created = new Date(item.createdAt);
            const sold = new Date(item.soldAt!);
            return sum + Math.floor((sold.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          }, 0);
          performance.averageDaysToSell = totalDays / soldItems.length;
        }
      }

      return performance;
    }).sort((a, b) => b.totalProfit - a.totalProfit);
  }
);

// Interface pour les paiements de dépôt-vente
export interface ConsignmentPayment {
  itemId: number;
  itemName: string;
  consignorName: string;
  sellingPrice: number;
  splitPercentage: number; // Obsolète mais gardé pour compatibilité
  commission: number; // Nouveau : montant ou pourcentage de commission
  commissionType: 'amount' | 'percentage'; // Nouveau : type de commission
  paymentAmount: number;
  soldAt: string;
  sourceId?: number;
  sourceName?: string;
}

// Sélecteur pour les paiements de dépôt-vente à effectuer
export const selectConsignmentPayments = createSelector(
  [selectAllItems, selectAllSources],
  (items, sources): ConsignmentPayment[] => {
    const sourceMap = new Map(sources.map(source => [source.id, source]));

    return items
      .filter(item => 
        item.isConsignment && 
        item.status === 'sold' && 
        item.consignorName && 
        item.consignorAmount && 
        item.soldAt
      )
      .map(item => ({
        itemId: item.id,
        itemName: item.name,
        consignorName: item.consignorName!,
        sellingPrice: item.sellingPrice,
        splitPercentage: 0, // Obsolète avec la nouvelle logique
        commission: item.consignmentCommission || 0, // Montant ou pourcentage de commission
        commissionType: item.consignmentCommissionType || 'amount', // 'amount' ou 'percentage'
        paymentAmount: item.consignorAmount!, // Montant que doit recevoir le déposant
        soldAt: item.soldAt!,
        sourceId: item.sourceId || undefined,
        sourceName: item.sourceId ? sourceMap.get(item.sourceId)?.name : undefined,
      }))
      .sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime());
  }
);

// Sélecteur pour le total des paiements de dépôt-vente
export const selectTotalConsignmentPayments = createSelector(
  [selectConsignmentPayments],
  (payments): number => {
    return payments.reduce((total, payment) => total + payment.paymentAmount, 0);
  }
); 