import { createSlice, createEntityAdapter, PayloadAction } from '@reduxjs/toolkit';
import type { Source } from '../types/source';
import { 
  loadSources, 
  createSource, 
  updateSource, 
  deleteSource 
} from './sourcesThunks';

export interface SourcesState {
  sources: ReturnType<typeof sourcesAdapter.getInitialState>;
  loading: boolean;
  error: string | null;
}

const sourcesAdapter = createEntityAdapter<Source>({
  selectId: (source) => source.id,
  sortComparer: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
});

const initialState: SourcesState = {
  sources: sourcesAdapter.getInitialState(),
  loading: false,
  error: null,
};

const sourcesSlice = createSlice({
  name: 'sources',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Load sources
      .addCase(loadSources.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadSources.fulfilled, (state, action) => {
        state.loading = false;
        sourcesAdapter.setAll(state.sources, action.payload);
      })
      .addCase(loadSources.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Create source
      .addCase(createSource.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createSource.fulfilled, (state, action) => {
        state.loading = false;
        sourcesAdapter.addOne(state.sources, action.payload);
      })
      .addCase(createSource.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Update source
      .addCase(updateSource.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateSource.fulfilled, (state, action) => {
        state.loading = false;
        sourcesAdapter.updateOne(state.sources, {
          id: action.payload.id,
          changes: action.payload
        });
      })
      .addCase(updateSource.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Delete source
      .addCase(deleteSource.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteSource.fulfilled, (state, action) => {
        state.loading = false;
        sourcesAdapter.removeOne(state.sources, action.payload);
      })
      .addCase(deleteSource.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = sourcesSlice.actions;

// Export the adapter selectors for use in components
export const sourcesSelectors = sourcesAdapter.getSelectors();
export const sourcesAdapter_ = sourcesAdapter;

export default sourcesSlice.reducer;