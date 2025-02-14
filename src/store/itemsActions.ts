import { createAction } from '@reduxjs/toolkit';
import type { Item } from '../types/item';

// Actions synchrones
export const setItems = createAction<Item[]>('items/setItems');
export const addItem = createAction<Item>('items/addItem');
export const updateItem = createAction<Item>('items/updateItem');
export const removeItem = createAction<number>('items/removeItem');
export const setSelectedItem = createAction<Item | null>('items/setSelectedItem');
export const clearSearchResults = createAction('items/clearSearchResults');
export const resetState = createAction('items/resetState');
export const deleteItem = createAction<number>('items/deleteItem'); 