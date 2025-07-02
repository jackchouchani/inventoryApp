import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { databaseInterface } from '../database/database';
import type { ItemHistory } from '../types/itemHistory';

interface AuditLogState {
  logs: ItemHistory[];
  total: number;
  currentPage: number;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuditLogState = {
  logs: [],
  total: 0,
  currentPage: 0,
  isLoading: false,
  error: null,
};

export const fetchGlobalAuditLog = createAsyncThunk(
  'auditLog/fetchGlobal',
  async ({ page, limit }: { page: number; limit: number }, { rejectWithValue }) => {
    try {
      const { history, total } = await databaseInterface.getGlobalHistory(page, limit);
      return { logs: history, total, page };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const auditLogSlice = createSlice({
  name: 'auditLog',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchGlobalAuditLog.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchGlobalAuditLog.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload.page === 0) {
          state.logs = action.payload.logs;
        } else {
          state.logs.push(...action.payload.logs);
        }
        state.total = action.payload.total;
        state.currentPage = action.payload.page;
      })
      .addCase(fetchGlobalAuditLog.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export default auditLogSlice.reducer;
