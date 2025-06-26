import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './store';
import { itemsAdapter } from './itemsAdapter';
import { categoriesAdapter } from './categorySlice';
import { containersAdapter } from './containersSlice';
import type { Item } from '../types/item';
import type { Category } from '../types/category';
import type { Container } from '../types/container';

// Sélecteurs de base optimisés
export const selectItemsState = (state: RootState) => state.items;
export const selectCategoriesState = (state: RootState) => state.categories;
export const selectContainersState = (state: RootState) => state.containers;

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

// Interface pour les filtres
export interface ItemFilters {
  status?: 'all' | 'available' | 'sold';
  categoryId?: number;
  containerId?: number;
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
  [selectFilteredItems, selectCategoryEntities, selectContainerEntities],
  (items, categories, containers) => {
    return items.map((item: Item) => ({
      ...item,
      category: item.categoryId ? categories[item.categoryId] : undefined,
      container: item.containerId ? containers[item.containerId] : undefined,
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