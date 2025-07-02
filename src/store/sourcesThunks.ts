import { createAsyncThunk } from '@reduxjs/toolkit';
import { databaseInterface } from '../database/database';
import type { Source, SourceInput, SourceUpdate } from '../types/source';

// Load all sources
export const loadSources = createAsyncThunk<
  Source[],
  void,
  { rejectValue: string }
>('sources/loadSources', async (_, { rejectWithValue }) => {
  try {
    const sources = await databaseInterface.getSources();
    return sources;
  } catch (error) {
    console.error('Error loading sources:', error);
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to load sources');
  }
});

// Create a new source
export const createSource = createAsyncThunk<
  Source,
  SourceInput,
  { rejectValue: string }
>('sources/createSource', async (sourceData, { rejectWithValue }) => {
  try {
    const sourceId = await databaseInterface.addSource(sourceData);
    const newSource = await databaseInterface.getSource(sourceId);
    
    if (!newSource) {
      throw new Error('Failed to retrieve created source');
    }
    
    return newSource;
  } catch (error) {
    console.error('Error creating source:', error);
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to create source');
  }
});

// Update an existing source
export const updateSource = createAsyncThunk<
  Source,
  { id: number; updates: SourceUpdate },
  { rejectValue: string }
>('sources/updateSource', async ({ id, updates }, { rejectWithValue }) => {
  try {
    await databaseInterface.updateSource(id, updates);
    const updatedSource = await databaseInterface.getSource(id);
    
    if (!updatedSource) {
      throw new Error('Failed to retrieve updated source');
    }
    
    return updatedSource;
  } catch (error) {
    console.error('Error updating source:', error);
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to update source');
  }
});

// Delete a source
export const deleteSource = createAsyncThunk<
  number,
  number,
  { rejectValue: string }
>('sources/deleteSource', async (sourceId, { rejectWithValue }) => {
  try {
    await databaseInterface.deleteSource(sourceId);
    return sourceId;
  } catch (error) {
    console.error('Error deleting source:', error);
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to delete source');
  }
});