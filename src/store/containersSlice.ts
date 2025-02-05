import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Container } from '../database/database';

interface ContainersState {
  containers: Container[];
  loading: boolean;
  error: string | null;
}

const initialState: ContainersState = {
  containers: [],
  loading: false,
  error: null
};

const containersSlice = createSlice({
  name: 'containers',
  initialState,
  reducers: {
    setContainers: (state, action: PayloadAction<Container[]>) => {
      state.containers = action.payload;
    },
    addContainer: (state, action: PayloadAction<Container>) => {
      state.containers.push(action.payload);
    },
    updateContainer: (state, action: PayloadAction<Container>) => {
      const index = state.containers.findIndex(c => c.id === action.payload.id);
      if (index !== -1) {
        state.containers[index] = action.payload;
      }
    }
  }
});

export const { setContainers, addContainer, updateContainer } = containersSlice.actions;
export default containersSlice.reducer;
