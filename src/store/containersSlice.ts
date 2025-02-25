import { createSlice, createEntityAdapter, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { Container } from '../database/database';
import { RootState } from './store';

// Type étendu pour garantir un ID non-null
export type ContainerWithId = Omit<Container, 'id'> & { id: number };

// Création de l'adaptateur pour les containers
export const containersAdapter = createEntityAdapter<ContainerWithId>({
  sortComparer: (a: ContainerWithId, b: ContainerWithId) => a.number - b.number,
});

// État initial avec l'adaptateur
const initialState = containersAdapter.getInitialState({
  status: 'idle',
  error: null as string | null,
  loading: false,
});

export type ContainersState = typeof initialState;

const containersSlice = createSlice({
  name: 'containers',
  initialState,
  reducers: {
    setContainers: (state, action: PayloadAction<Container[]>) => {
      const containersWithId = action.payload.filter((container): container is ContainerWithId => container.id !== undefined);
      containersAdapter.setAll(state, containersWithId);
    },
    addContainer: (state, action: PayloadAction<Container>) => {
      if (action.payload.id) {
        containersAdapter.addOne(state, action.payload as ContainerWithId);
      }
    },
    updateContainer: (state, action: PayloadAction<Container>) => {
      if (action.payload.id) {
        containersAdapter.updateOne(state, {
          id: action.payload.id,
          changes: action.payload,
        });
      }
    },
    removeContainer: (state, action: PayloadAction<number>) => {
      containersAdapter.removeOne(state, action.payload);
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
  }
});

// Sélecteurs de base
export const {
  selectAll: selectAllContainers,
  selectById: selectContainerById,
  selectIds: selectContainerIds,
  selectTotal: selectTotalContainers,
} = containersAdapter.getSelectors<RootState>((state) => state.containers);

// Sélecteurs mémorisés
export const selectContainerWithItems = createSelector(
  [selectAllContainers, (state: RootState) => state.items],
  (containers, itemsState) => {
    return containers.map(container => ({
      ...container,
      items: Object.values(itemsState.entities || {}).filter(
        item => item?.containerId === container.id
      )
    }));
  }
);

// Nouveau sélecteur pour le compte d'items par container
export const selectContainersWithItemsCount = createSelector(
  [selectAllContainers, (state: RootState) => state.items],
  (containers, itemsState) => {
    const itemsArray = Object.values(itemsState.entities || {});
    return containers.map(container => ({
      ...container,
      itemCount: itemsArray.filter(item => item?.containerId === container.id).length
    }));
  }
);

// Sélecteur pour obtenir les containers avec des statistiques
export const selectContainersWithStats = createSelector(
  [selectAllContainers, (state: RootState) => state.items],
  (containers, itemsState) => {
    const itemsArray = Object.values(itemsState.entities || {});
    return containers.map(container => {
      const containerItems = itemsArray.filter(item => item?.containerId === container.id);
      const totalValue = containerItems.reduce((sum, item) => sum + (item?.sellingPrice || 0), 0);
      const availableItems = containerItems.filter(item => item?.status === 'available').length;
      const soldItems = containerItems.filter(item => item?.status === 'sold').length;

      return {
        ...container,
        itemCount: containerItems.length,
        totalValue,
        availableItems,
        soldItems
      };
    });
  }
);

// Sélecteur pour obtenir un container spécifique avec ses statistiques
export const selectContainerWithStats = createSelector(
  [selectContainersWithStats, (state: RootState, containerId: number) => containerId],
  (containersWithStats, containerId) => 
    containersWithStats.find(container => container.id === containerId)
);

export const selectContainerByNumber = createSelector(
  [selectAllContainers, (state, number: number) => number],
  (containers, number) => containers.find(
    container => container.number === number
  )
);

export const selectContainersStatus = (state: RootState) => state.containers.status;
export const selectContainersError = (state: RootState) => state.containers.error;
export const selectContainersLoading = (state: RootState) => state.containers.loading;

export const { setContainers, addContainer, updateContainer, removeContainer, setLoading, setError, setStatus } = containersSlice.actions;
export default containersSlice.reducer;
