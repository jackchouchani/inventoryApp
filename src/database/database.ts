import { Platform } from 'react-native';
import { Container, DatabaseInterface, Item, Category } from './types';
import webDatabase from './webDatabase';
import nativeDatabase from './nativeDatabase';
import supabaseDatabase from './supabaseDatabase';
// import { logService } from '../services/logService';

const isWeb = Platform.OS === 'web';
const useSupabase = false; // Flag pour basculer entre SQLite et Supabase

// Sélectionner l'implémentation de la base de données
const getImplementation = () => {
  if (useSupabase) return supabaseDatabase;
  return isWeb ? webDatabase : nativeDatabase;
};

// Exporter les fonctions avec l'implémentation appropriée
export const initDatabase = async () => getImplementation().initDatabase();
export const getItems = async () => getImplementation().getItems();
export const addItem = async (item: Item) => {
  const result = await getImplementation().addItem(item);
  if (useSupabase) {
    // await logService.logAction('add_item', { item_id: result, name: item.name });
  }
  return result;
};
export const updateItem = isWeb ? webDatabase.updateItem.bind(webDatabase) : nativeDatabase.updateItem;
export const getContainers = isWeb ? webDatabase.getContainers.bind(webDatabase) : nativeDatabase.getContainers;
export const getCategories = isWeb ? webDatabase.getCategories.bind(webDatabase) : nativeDatabase.getCategories;
export const addContainer = isWeb ? webDatabase.addContainer.bind(webDatabase) : nativeDatabase.addContainer;
export const addCategory = isWeb ? webDatabase.addCategory.bind(webDatabase) : nativeDatabase.addCategory;
export const resetDatabase = isWeb ? webDatabase.resetDatabase.bind(webDatabase) : nativeDatabase.resetDatabase;
export const getDatabase = isWeb ? webDatabase.getDatabase.bind(webDatabase) : nativeDatabase.getDatabase;
export const updateItemStatus = isWeb ? webDatabase.updateItemStatus.bind(webDatabase) : nativeDatabase.updateItemStatus;
export const deleteContainer = isWeb ? webDatabase.deleteContainer.bind(webDatabase) : nativeDatabase.deleteContainer;
export const updateContainer = isWeb ? webDatabase.updateContainer.bind(webDatabase) : nativeDatabase.updateContainer;

export const getContainerByQRCode = async (qrCode: string): Promise<Container | null> => {
    const containers = await getContainers();
    return containers.find(container => container.qrCode === qrCode) || null;
};

export const getItemByQRCode = async (qrCode: string): Promise<Item | null> => {
    const items = await getItems();
    return items.find(item => item.qrCode === qrCode) || null;
};

export type { Item, Container, Category } from './types';