import { Container, DatabaseInterface, Item, Category } from './types';

import supabaseDatabase from './supabaseDatabase';
import { logService } from '../services/logService';

// Wrapper pour ajouter le logging aux fonctions
const withLogging = (fn: Function, actionName: string) => {
  return async (...args: any[]) => {
    const result = await fn(...args);
    await logService.logAction(actionName, { args });
    return result;
  };
};

// Exporter les fonctions avec logging
export const {
  getItems,
  getCategories,
  getContainers,
  addItem: rawAddItem,
  updateItem: rawUpdateItem,
  addCategory: rawAddCategory,
  addContainer: rawAddContainer,
  resetDatabase: rawResetDatabase,
  getDatabase,
  updateItemStatus: rawUpdateItemStatus,
  deleteContainer: rawDeleteContainer,
  updateContainer: rawUpdateContainer,
  getContainerByQRCode,
  getItemByQRCode,
  validateQRCode,
  getCategory,
  updateCategory: rawUpdateCategory,
  deleteCategory: rawDeleteCategory,
  getItemOrContainerByQRCode,
  storePhotoUri,
  getPhotoUris,
  removePhotoUri,
  saveDatabase
} = supabaseDatabase;

// Réexporter les fonctions avec logging
export const addItem = withLogging(rawAddItem, 'ADD_ITEM');
export const updateItem = withLogging(rawUpdateItem, 'UPDATE_ITEM');
export const addCategory = withLogging(rawAddCategory, 'ADD_CATEGORY');
export const addContainer = withLogging(rawAddContainer, 'ADD_CONTAINER');
export const resetDatabase = withLogging(rawResetDatabase, 'RESET_DATABASE');
export const updateItemStatus = withLogging(rawUpdateItemStatus, 'UPDATE_ITEM_STATUS');
export const deleteContainer = withLogging(rawDeleteContainer, 'DELETE_CONTAINER');
export const updateContainer = withLogging(rawUpdateContainer, 'UPDATE_CONTAINER');
export const updateCategory = withLogging(rawUpdateCategory, 'UPDATE_CATEGORY');
export const deleteCategory = withLogging(rawDeleteCategory, 'DELETE_CATEGORY');

// Réexporter les types
export type { Item, Container, Category } from './types';