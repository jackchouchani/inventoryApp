import type { Item, ItemInput, ItemUpdate } from '../types/item';
import type { Category, CategoryInput, CategoryUpdate } from '../types/category';
import type { Container, ContainerInput, ContainerUpdate } from '../types/container';
import type { Location, LocationInput } from '../types/location';
import type { Source, SourceInput, SourceUpdate } from '../types/source';
import type { ItemHistory } from '../types/itemHistory';

import supabaseDatabase from './supabaseDatabase';
import { logService } from '../services/logService';
import { generateContainerQRCode, generateItemQRCode } from '../utils/qrCodeGenerator';

export const database = supabaseDatabase;

// Wrapper pour ajouter le logging aux fonctions
const withLogging = (fn: Function, actionName: string) => {
  return async (...args: any[]) => {
    const result = await fn(...args);
    
    // Log l'action avec les arguments et le résultat
    await logService.logAction(actionName, {
      arguments: args,
      result: result || null
    });
    
    return result;
  };
};

// Créer une copie de l'objet supabaseDatabase avec les méthodes liées
const boundDatabase = {
  getItems: supabaseDatabase.getItems.bind(supabaseDatabase),
  getItem: supabaseDatabase.getItem.bind(supabaseDatabase),
  searchItems: supabaseDatabase.searchItems.bind(supabaseDatabase),
  getContainers: supabaseDatabase.getContainers.bind(supabaseDatabase),
  getCategories: supabaseDatabase.getCategories.bind(supabaseDatabase),
  getLocations: supabaseDatabase.getLocations.bind(supabaseDatabase),
  getLocationByQRCode: supabaseDatabase.getLocationByQRCode.bind(supabaseDatabase),
  getDatabase: supabaseDatabase.getDatabase.bind(supabaseDatabase),
  getItemByQRCode: supabaseDatabase.getItemByQRCode.bind(supabaseDatabase),
  getContainerByQRCode: supabaseDatabase.getContainerByQRCode.bind(supabaseDatabase),
  getCategory: supabaseDatabase.getCategory.bind(supabaseDatabase),
  getPhotoUris: supabaseDatabase.getPhotoUris.bind(supabaseDatabase),
  validateQRCode: supabaseDatabase.validateQRCode.bind(supabaseDatabase),
  getItemOrContainerByQRCode: supabaseDatabase.getItemOrContainerByQRCode.bind(supabaseDatabase),
  addItem: supabaseDatabase.addItem.bind(supabaseDatabase),
  updateItem: supabaseDatabase.updateItem.bind(supabaseDatabase),
  deleteItem: supabaseDatabase.deleteItem.bind(supabaseDatabase),
  updateItemStatus: supabaseDatabase.updateItemStatus.bind(supabaseDatabase),
  addContainer: supabaseDatabase.addContainer.bind(supabaseDatabase),
  updateContainer: supabaseDatabase.updateContainer.bind(supabaseDatabase),
  deleteContainer: supabaseDatabase.deleteContainer.bind(supabaseDatabase),
  addLocation: supabaseDatabase.addLocation.bind(supabaseDatabase),
  updateLocation: supabaseDatabase.updateLocation.bind(supabaseDatabase),
  deleteLocation: supabaseDatabase.deleteLocation.bind(supabaseDatabase),
  addCategory: supabaseDatabase.addCategory.bind(supabaseDatabase),
  updateCategory: supabaseDatabase.updateCategory.bind(supabaseDatabase),
  deleteCategory: supabaseDatabase.deleteCategory.bind(supabaseDatabase),
  removePhotoUri: supabaseDatabase.removePhotoUri.bind(supabaseDatabase),
  saveDatabase: supabaseDatabase.saveDatabase.bind(supabaseDatabase),
  resetDatabase: supabaseDatabase.resetDatabase.bind(supabaseDatabase),
  storePhotoUri: supabaseDatabase.storePhotoUri.bind(supabaseDatabase),
  getSources: supabaseDatabase.getSources.bind(supabaseDatabase),
  getSource: supabaseDatabase.getSource.bind(supabaseDatabase),
  addSource: supabaseDatabase.addSource.bind(supabaseDatabase),
  updateSource: supabaseDatabase.updateSource.bind(supabaseDatabase),
  deleteSource: supabaseDatabase.deleteSource.bind(supabaseDatabase)
  getItemHistory: supabaseDatabase.getItemHistory.bind(supabaseDatabase),
  getGlobalHistory: supabaseDatabase.getGlobalHistory.bind(supabaseDatabase)
};

// Exporter les fonctions avec logging
export const databaseInterface: DatabaseInterface = {
  ...boundDatabase,
  addItem: withLogging(boundDatabase.addItem, 'ADD_ITEM'),
  updateItem: withLogging(boundDatabase.updateItem, 'UPDATE_ITEM'),
  deleteItem: withLogging(boundDatabase.deleteItem, 'DELETE_ITEM'),
  updateItemStatus: withLogging(boundDatabase.updateItemStatus, 'UPDATE_ITEM_STATUS'),
  addContainer: withLogging(boundDatabase.addContainer, 'ADD_CONTAINER'),
  updateContainer: withLogging(boundDatabase.updateContainer, 'UPDATE_CONTAINER'),
  deleteContainer: withLogging(boundDatabase.deleteContainer, 'DELETE_CONTAINER'),
  addLocation: withLogging(boundDatabase.addLocation, 'ADD_LOCATION'),
  updateLocation: withLogging(boundDatabase.updateLocation, 'UPDATE_LOCATION'),
  deleteLocation: withLogging(boundDatabase.deleteLocation, 'DELETE_LOCATION'),
  addCategory: withLogging(boundDatabase.addCategory, 'ADD_CATEGORY'),
  updateCategory: withLogging(boundDatabase.updateCategory, 'UPDATE_CATEGORY'),
  deleteCategory: withLogging(boundDatabase.deleteCategory, 'DELETE_CATEGORY'),
  addSource: withLogging(boundDatabase.addSource, 'ADD_SOURCE'),
  updateSource: withLogging(boundDatabase.updateSource, 'UPDATE_SOURCE'),
  deleteSource: withLogging(boundDatabase.deleteSource, 'DELETE_SOURCE'),
  removePhotoUri: withLogging(boundDatabase.removePhotoUri, 'REMOVE_PHOTO'),
  saveDatabase: withLogging(boundDatabase.saveDatabase, 'SAVE_DATABASE'),
  resetDatabase: withLogging(boundDatabase.resetDatabase, 'RESET_DATABASE'),
  storePhotoUri: withLogging(boundDatabase.storePhotoUri, 'STORE_PHOTO'),
  getItems: boundDatabase.getItems,
  getItem: boundDatabase.getItem,
  searchItems: boundDatabase.searchItems,
  getContainers: boundDatabase.getContainers,
  getCategories: boundDatabase.getCategories,
  getLocations: boundDatabase.getLocations,
  getLocationByQRCode: boundDatabase.getLocationByQRCode,
  getDatabase: boundDatabase.getDatabase,
  getItemByQRCode: boundDatabase.getItemByQRCode,
  getContainerByQRCode: boundDatabase.getContainerByQRCode,
  getCategory: boundDatabase.getCategory,
  getSources: boundDatabase.getSources,
  getSource: boundDatabase.getSource,
  getPhotoUris: boundDatabase.getPhotoUris,
  validateQRCode: boundDatabase.validateQRCode,
  getItemOrContainerByQRCode: boundDatabase.getItemOrContainerByQRCode
};

// Réexporter les types
export type { Item, ItemInput, ItemUpdate } from '../types/item';
export type { Category, CategoryInput, CategoryUpdate } from '../types/category';
export type { Container, ContainerInput, ContainerUpdate } from '../types/container';
export type { Location, LocationInput, LocationUpdate } from '../types/location';
export type { Source, SourceInput, SourceUpdate } from '../types/source';
export type { ItemHistory } from '../types/itemHistory';

export interface DatabaseInterface {
    // Méthodes pour les items
    addItem: (item: ItemInput) => Promise<number>;
    updateItem: (id: number, item: ItemUpdate) => Promise<void>;
    deleteItem: (id: number) => Promise<void>;
    getItems: () => Promise<Item[]>;
    getItem: (id: number) => Promise<Item | null>;
    getItemHistory: (itemId: number) => Promise<ItemHistory[]>;
    getGlobalHistory: (page: number, limit: number) => Promise<{ history: ItemHistory[], total: number }>;
    searchItems: (query: string) => Promise<Item[]>;
    updateItemStatus: (id: number, status: Item['status']) => Promise<void>;
    getItemByQRCode: (qrCode: string) => Promise<Item | null>;

    // Méthodes pour les catégories
    addCategory: (category: CategoryInput) => Promise<number>;
    updateCategory: (id: number, data: CategoryUpdate) => Promise<void>;
    deleteCategory: (id: number) => Promise<void>;
    getCategories: () => Promise<Category[]>;
    getCategory: (id: number) => Promise<Category | null>;

    // Méthodes pour les containers
    addContainer: (container: ContainerInput) => Promise<number>;
    updateContainer: (id: number, container: ContainerUpdate) => Promise<void>;
    deleteContainer: (id: number) => Promise<void>;
    getContainers: () => Promise<Container[]>;
    getContainerByQRCode: (qrCode: string) => Promise<Container | null>;

    // Méthodes pour les emplacements
    addLocation: (location: LocationInput) => Promise<number>;
    updateLocation: (id: number, location: Partial<LocationInput>) => Promise<void>;
    deleteLocation: (id: number) => Promise<void>;
    getLocations: () => Promise<Location[]>;
    getLocationByQRCode: (qrCode: string) => Promise<Location | null>;

    // Méthodes pour les sources
    addSource: (source: SourceInput) => Promise<number>;
    updateSource: (id: number, source: SourceUpdate) => Promise<void>;
    deleteSource: (id: number) => Promise<void>;
    getSources: () => Promise<Source[]>;
    getSource: (id: number) => Promise<Source | null>;

    // Méthodes utilitaires
    validateQRCode: (type: 'ITEM' | 'CONTAINER' | 'LOCATION', qrCode: string) => Promise<boolean>;
    getItemOrContainerByQRCode: (type: 'ITEM' | 'CONTAINER' | 'LOCATION', qrCode: string) => Promise<boolean>;
    storePhotoUri: (uri: string) => Promise<void>;
    getPhotoUris: () => Promise<string[]>;
    removePhotoUri: (uri: string) => Promise<void>;
    saveDatabase: (data: {
        items: Array<Omit<Item, 'id' | 'createdAt' | 'updatedAt'>>;
        containers: Array<Omit<Container, 'id' | 'createdAt' | 'updatedAt'>>;
        categories: Array<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>;
    }) => Promise<void>;
    resetDatabase: () => Promise<void>;
    getDatabase: () => Promise<{
        items: Item[];
        containers: Container[];
        categories: Category[];
        locations: Location[];
    }>;
}

export const createContainer = async (_data: Omit<Container, 'id' | 'qrCode' | 'createdAt' | 'updatedAt'>): Promise<Container> => {
      const qrCode = generateContainerQRCode();
  

  const container = await database.getContainerByQRCode(qrCode);
  if (!container) throw new Error('Container not found after creation');
  
  return container;
};

export const createItem = async (_data: Omit<Item, 'id' | 'qrCode' | 'createdAt' | 'updatedAt'>): Promise<Item> => {
  const qrCode = generateItemQRCode();
  

  const item = await database.getItemByQRCode(qrCode);
  if (!item) throw new Error('Item not found after creation');
  
  return item;
};