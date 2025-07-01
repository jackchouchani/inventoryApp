import { createSlice, createEntityAdapter, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { Location } from '../types/location';
import { RootState } from './store';
import { fetchLocations, createLocation, updateLocation as updateLocationThunk, deleteLocation as deleteLocationThunk } from './locationsThunks';

// Type étendu pour garantir un ID non-null
export type LocationWithId = Omit<Location, 'id'> & { id: number };

// Création de l'adaptateur pour les locations
export const locationsAdapter = createEntityAdapter<LocationWithId>({
  sortComparer: (a: LocationWithId, b: LocationWithId) => a.name.localeCompare(b.name),
});

// État initial avec l'adaptateur
const initialState = locationsAdapter.getInitialState({
  status: 'idle',
  error: null as string | null,
  loading: false,
  offline: {
    isOffline: false,
    lastSyncTime: null,
    pendingEvents: 0,
    syncInProgress: false,
    syncErrors: []
  },
  localChanges: 0,
});

export type LocationsState = typeof initialState;

const locationsSlice = createSlice({
  name: 'locations',
  initialState,
  reducers: {
    setLocations: (state, action: PayloadAction<Location[]>) => {
      const locationsWithId = action.payload.filter((location): location is LocationWithId => location.id !== undefined);
      locationsAdapter.setAll(state, locationsWithId);
    },
    addLocation: (state, action: PayloadAction<Location>) => {
      if (action.payload.id) {
        locationsAdapter.addOne(state, action.payload as LocationWithId);
      }
    },
    updateLocation: (state, action: PayloadAction<Location>) => {
      if (action.payload.id) {
        locationsAdapter.updateOne(state, {
          id: action.payload.id,
          changes: action.payload,
        });
      }
    },
    removeLocation: (state, action: PayloadAction<number>) => {
      locationsAdapter.removeOne(state, action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setStatus: (state, action: PayloadAction<'idle' | 'loading' | 'succeeded' | 'failed'>) => {
      state.status = action.payload;
    }
  },
  // ✅ AJOUT des extraReducers pour gérer les thunks asynchrones
  extraReducers: (builder) => {
    builder
      // Fetch locations
      .addCase(fetchLocations.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchLocations.fulfilled, (state, action) => {
        console.log('[locationsSlice] fetchLocations.fulfilled - Locations reçues:', action.payload.length);
        state.status = 'succeeded';
        state.error = null;
        const locationsWithId = action.payload.filter((location): location is LocationWithId => location.id !== undefined);
        locationsAdapter.setAll(state, locationsWithId);
      })
      .addCase(fetchLocations.rejected, (state, action) => {
        console.log('[locationsSlice] fetchLocations.rejected - Erreur:', action.payload);
        state.status = 'failed';
        state.error = (action.payload as any)?.message || 'Erreur lors du chargement des emplacements';
      })
      // Create location
      .addCase(createLocation.fulfilled, (state, action) => {
        locationsAdapter.addOne(state, action.payload as LocationWithId);
      })
      // Update location
      .addCase(updateLocationThunk.fulfilled, (state, action) => {
        locationsAdapter.upsertOne(state, action.payload as LocationWithId);
      })
      // Delete location
      .addCase(deleteLocationThunk.fulfilled, (state, action) => {
        const locationId = action.meta.arg;
        locationsAdapter.removeOne(state, locationId);
      });
  }
});

// Sélecteurs de base
export const {
  selectAll: selectAllLocations,
  selectById: selectLocationById,
  selectIds: selectLocationIds,
  selectTotal: selectTotalLocations,
} = locationsAdapter.getSelectors<RootState>((state) => state.locations);

// Sélecteurs mémorisés
export const selectLocationWithContainers = createSelector(
  [selectAllLocations, (state: RootState) => state.containers],
  (locations, containersState) => {
    return locations.map((location: any) => ({
      ...location,
      containers: Object.values(containersState.entities || {}).filter(
        (container: any) => container?.locationId === location.id
      )
    }));
  }
);

// Nouveau sélecteur pour le compte de containers par location
export const selectLocationsWithContainersCount = createSelector(
  [selectAllLocations, (state: RootState) => state.containers],
  (locations, containersState) => {
    const containersArray = Object.values(containersState.entities || {});
    return locations.map((location: any) => ({
      ...location,
      containerCount: containersArray.filter((container: any) => container?.locationId === location.id).length
    }));
  }
);

// Sélecteur pour obtenir les locations avec des statistiques
export const selectLocationsWithStats = createSelector(
  [selectAllLocations, (state: RootState) => state.containers, (state: RootState) => state.items],
  (locations, containersState, itemsState) => {
    const containersArray = Object.values(containersState.entities || {});
    const itemsArray = Object.values(itemsState.entities || {});
    
    return locations.map((location: any) => {
      const locationContainers = containersArray.filter((container: any) => container?.locationId === location.id);
      const directItems = itemsArray.filter((item: any) => item?.locationId === location.id && !item.containerId);
      const containersItems = itemsArray.filter((item: any) => 
        item?.containerId && locationContainers.some((container: any) => container?.id === item.containerId)
      );
      const allLocationItems = [...directItems, ...containersItems];
      
      const totalValue = allLocationItems.reduce((sum: number, item: any) => sum + (item?.sellingPrice || 0), 0);
      const availableItems = allLocationItems.filter((item: any) => item?.status === 'available').length;
      const soldItems = allLocationItems.filter((item: any) => item?.status === 'sold').length;

      return {
        ...location,
        containerCount: locationContainers.length,
        itemCount: allLocationItems.length,
        totalValue,
        availableItems,
        soldItems
      };
    });
  }
);

// Sélecteur pour obtenir une location spécifique avec ses statistiques
export const selectLocationWithStats = createSelector(
  [selectLocationsWithStats, (_state: RootState, locationId: number) => locationId],
  (locationsWithStats, locationId) => 
    locationsWithStats.find((location: any) => location.id === locationId)
);

export const selectLocationsStatus = (state: RootState) => state.locations.status;
export const selectLocationsError = (state: RootState) => state.locations.error;
export const selectLocationsLoading = (state: RootState) => state.locations.loading;

export const { setLocations, addLocation, updateLocation, removeLocation, setLoading, setError, setStatus } = locationsSlice.actions;
export default locationsSlice.reducer;