import { createSlice, createEntityAdapter, PayloadAction, createSelector, EntityId } from '@reduxjs/toolkit';
import { Item } from '../database/database';
import { RootState } from './store';
import { fetchItems, fetchItemByBarcode, fetchSimilarItems, updateItemStatus, moveItem, bulkUpdateItems } from './itemsThunks';

// Type étendu pour garantir un ID non-null
export type ItemWithId = Omit<Item, 'id'> & { id: number };

// Création de l'adaptateur d'entités
export const itemsAdapter = createEntityAdapter<ItemWithId>({
  sortComparer: (a: ItemWithId, b: ItemWithId) => {
    const aDate = a.updatedAt || '';
    const bDate = b.updatedAt || '';
    return bDate.localeCompare(aDate);
  }
});

// Sélecteurs générés par l'adaptateur
export const {
  selectAll: selectAllItems,
  selectById: selectItemById,
  selectIds: selectItemIds,
} = itemsAdapter.getSelectors<RootState>((state) => state.items);

// État initial avec l'adaptateur
const initialState = itemsAdapter.getInitialState({
  status: 'idle' as 'idle' | 'loading' | 'succeeded' | 'failed',
  error: null as string | null,
  searchResults: [] as Item[],
  selectedItem: null as Item | null,
  similarItems: [] as Item[],
  currentPage: 0,
  totalItems: 0,
  hasMore: false,
});

const itemsSlice = createSlice({
  name: 'items',
  initialState,
  reducers: {
    setItems: (state, action: PayloadAction<Item[]>) => {
      const itemsWithId = action.payload.filter((item): item is ItemWithId => item.id !== undefined);
      itemsAdapter.setAll(state, itemsWithId);
    },
    addItem: (state, action: PayloadAction<Item>) => {
      if (action.payload.id) {
        itemsAdapter.addOne(state, action.payload as ItemWithId);
      }
    },
    updateItem: (state, action: PayloadAction<Item>) => {
      if (action.payload.id) {
        itemsAdapter.updateOne(state, {
          id: action.payload.id,
          changes: action.payload,
        });
      }
    },
    removeItem: (state, action: PayloadAction<number>) => {
      itemsAdapter.removeOne(state, action.payload);
    },
    setSelectedItem: (state, action: PayloadAction<Item | null>) => {
      state.selectedItem = action.payload;
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
    resetState: () => initialState
  },
  extraReducers: (builder) => {
    // Gestion de fetchItems
    builder
      .addCase(fetchItems.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchItems.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.searchResults = action.payload.items;
        state.totalItems = action.payload.total;
        state.hasMore = action.payload.hasMore;
        state.currentPage = state.currentPage + 1;
        itemsAdapter.setMany(state, action.payload.items as ItemWithId[]);
      })
      .addCase(fetchItems.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      // Gestion de fetchItemByBarcode
      .addCase(fetchItemByBarcode.fulfilled, (state, action) => {
        if (action.payload) {
          state.selectedItem = action.payload;
          itemsAdapter.upsertOne(state, action.payload as ItemWithId);
        }
      })
      // Gestion de fetchSimilarItems
      .addCase(fetchSimilarItems.fulfilled, (state, action) => {
        state.similarItems = action.payload;
        itemsAdapter.upsertMany(state, action.payload as ItemWithId[]);
      })
      // Gestion de updateItemStatus
      .addCase(updateItemStatus.fulfilled, (state, action) => {
        itemsAdapter.upsertOne(state, action.payload as ItemWithId);
        if (state.selectedItem?.id === action.payload.id) {
          state.selectedItem = action.payload;
        }
      })
      // Gestion de moveItem
      .addCase(moveItem.fulfilled, (state, action) => {
        itemsAdapter.upsertOne(state, action.payload as ItemWithId);
        if (state.selectedItem?.id === action.payload.id) {
          state.selectedItem = action.payload;
        }
      })
      // Gestion de bulkUpdateItems
      .addCase(bulkUpdateItems.fulfilled, (state, action) => {
        itemsAdapter.upsertMany(state, action.payload as ItemWithId[]);
      });
  }
});

// Sélecteurs mémorisés
export const selectItemsByContainer = createSelector(
  [selectAllItems, (state, containerId: number) => containerId],
  (items, containerId) => items.filter(item => item.containerId === containerId)
);

export const selectItemsByCategory = createSelector(
  [selectAllItems, (state, categoryId: number) => categoryId],
  (items, categoryId) => items.filter(item => item.categoryId === categoryId)
);

export const selectCategoryStatistics = createSelector(
  [selectAllItems],
  (items) => {
    const stats = new Map();
    items.forEach(item => {
      if (!item.categoryId) return;
      
      const categoryStats = stats.get(item.categoryId) || {
        itemCount: 0,
        totalValue: 0,
        averagePrice: 0
      };
      
      categoryStats.itemCount++;
      categoryStats.totalValue += item.sellingPrice;
      categoryStats.averagePrice = categoryStats.totalValue / categoryStats.itemCount;
      
      stats.set(item.categoryId, categoryStats);
    });
    return Array.from(stats.entries()).map(([categoryId, stats]) => ({
      categoryId,
      ...stats
    }));
  }
);

export const selectFilteredItems = createSelector(
  [selectAllItems, (state, filter: string) => filter.toLowerCase()],
  (items, filter) => {
    if (!filter) return items;
    return items.filter(item => 
      item.name.toLowerCase().includes(filter) ||
      item.description?.toLowerCase().includes(filter)
    );
  }
);

// Sélecteurs avancés pour les statistiques
export const selectItemsStatistics = createSelector(
  [selectAllItems],
  (items) => {
    const stats = {
      totalItems: items.length,
      totalValue: 0,
      averagePrice: 0,
      totalProfit: 0,
      itemsByStatus: {
        available: 0,
        sold: 0
      },
      profitMargin: 0,
      bestSellingItems: [] as ItemWithId[],
      worstSellingItems: [] as ItemWithId[]
    };

    items.forEach(item => {
      stats.totalValue += item.sellingPrice;
      stats.totalProfit += item.sellingPrice - item.purchasePrice;
      stats.itemsByStatus[item.status]++;
    });

    stats.averagePrice = stats.totalValue / (stats.totalItems || 1);
    stats.profitMargin = (stats.totalProfit / stats.totalValue) * 100;

    // Tri des items par profit
    const sortedItems = [...items].sort((a, b) => 
      (b.sellingPrice - b.purchasePrice) - (a.sellingPrice - a.purchasePrice)
    );

    stats.bestSellingItems = sortedItems.slice(0, 5);
    stats.worstSellingItems = sortedItems.slice(-5).reverse();

    return stats;
  }
);

export const selectItemsTrends = createSelector(
  [selectAllItems],
  (items) => {
    const now = new Date();
    const sixMonthsAgo = new Date(now.setMonth(now.getMonth() - 6));
    
    const monthlyStats = new Map();

    items.forEach(item => {
      if (!item.soldAt) return;

      const soldDate = new Date(item.soldAt);
      if (soldDate < sixMonthsAgo) return;

      const monthKey = `${soldDate.getFullYear()}-${(soldDate.getMonth() + 1).toString().padStart(2, '0')}`;
      
      const monthStat = monthlyStats.get(monthKey) || {
        totalSales: 0,
        totalRevenue: 0,
        totalProfit: 0,
        itemCount: 0
      };

      monthStat.totalSales++;
      monthStat.totalRevenue += item.sellingPrice;
      monthStat.totalProfit += item.sellingPrice - item.purchasePrice;
      monthStat.itemCount++;

      monthlyStats.set(monthKey, monthStat);
    });

    return Array.from(monthlyStats.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, stats]) => ({
        month,
        ...stats,
        averagePrice: stats.totalRevenue / stats.itemCount,
        profitMargin: (stats.totalProfit / stats.totalRevenue) * 100
      }));
  }
);

export const selectItemsPerformance = createSelector(
  [selectAllItems, (state, period: number = 30) => period],
  (items, period) => {
    const now = new Date();
    const startDate = new Date(now.setDate(now.getDate() - period));

    const recentItems = items.filter(item => {
      if (!item.soldAt) return false;
      const soldDate = new Date(item.soldAt);
      return soldDate >= startDate;
    });

    return {
      periodSales: recentItems.length,
      periodRevenue: recentItems.reduce((sum, item) => sum + item.sellingPrice, 0),
      periodProfit: recentItems.reduce((sum, item) => sum + (item.sellingPrice - item.purchasePrice), 0),
      averageDailySales: recentItems.length / period,
      topCategories: Object.entries(
        recentItems.reduce((acc, item) => {
          if (!item.categoryId) return acc;
          acc[item.categoryId] = (acc[item.categoryId] || 0) + 1;
          return acc;
        }, {} as Record<number, number>)
      ).sort((a, b) => b[1] - a[1]).slice(0, 3)
    };
  }
);

// Nouveaux sélecteurs pour l'état de chargement et les erreurs
export const selectItemsStatus = (state: RootState) => state.items.status;
export const selectItemsError = (state: RootState) => state.items.error;
export const selectSearchResults = (state: RootState) => state.items.searchResults;
export const selectSelectedItem = (state: RootState) => state.items.selectedItem;
export const selectSimilarItems = (state: RootState) => state.items.similarItems;
export const selectHasMore = (state: RootState) => state.items.hasMore;
export const selectCurrentPage = (state: RootState) => state.items.currentPage;
export const selectTotalItemsCount = (state: RootState) => state.items.totalItems;

export const { 
  setItems, 
  addItem, 
  updateItem, 
  removeItem, 
  setSelectedItem, 
  clearSearchResults,
  resetState 
} = itemsSlice.actions;

export default itemsSlice.reducer; 