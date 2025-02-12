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

export const selectContainerByNumber = createSelector(
  [selectAllContainers, (state, number: number) => number],
  (containers, number) => containers.find(
    container => container.number === number
  )
);

export const selectContainersStatus = (state: RootState) => state.containers.status;
export const selectContainersError = (state: RootState) => state.containers.error;
export const selectContainersLoading = (state: RootState) => state.containers.loading;

export const { setContainers, addContainer, updateContainer, setLoading, setError, setStatus } = containersSlice.actions;
export default containersSlice.reducer;
