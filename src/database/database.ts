import { Platform } from 'react-native';
import { Container, DatabaseInterface, Item } from './types';
import webDatabase from './webDatabase';
import nativeDatabase from './nativeDatabase';

const isWeb = Platform.OS === 'web';

// Définir les fonctions de base de données en fonction de la plateforme
export const initDatabase = isWeb ? webDatabase.initDatabase.bind(webDatabase) : nativeDatabase.initDatabase;
export const getItems = isWeb ? webDatabase.getItems.bind(webDatabase) : nativeDatabase.getItems;
export const addItem = isWeb ? webDatabase.addItem.bind(webDatabase) : nativeDatabase.addItem;
export const updateItem = isWeb ? webDatabase.updateItem.bind(webDatabase) : nativeDatabase.updateItem;
export const getContainers = isWeb ? webDatabase.getContainers.bind(webDatabase) : nativeDatabase.getContainers;
export const getCategories = isWeb ? webDatabase.getCategories.bind(webDatabase) : nativeDatabase.getCategories;
export const addContainer = isWeb ? webDatabase.addContainer.bind(webDatabase) : nativeDatabase.addContainer;
export const addCategory = isWeb ? webDatabase.addCategory.bind(webDatabase) : nativeDatabase.addCategory;
export const resetDatabase = isWeb ? webDatabase.resetDatabase.bind(webDatabase) : nativeDatabase.resetDatabase;
export const getDatabase = isWeb ? webDatabase.getDatabase.bind(webDatabase) : nativeDatabase.getDatabase;
export const updateItemStatus = isWeb ? webDatabase.updateItemStatus.bind(webDatabase) : nativeDatabase.updateItemStatus;

export const getContainerByQRCode = async (qrCode: string): Promise<Container | null> => {
    const containers = await getContainers();
    return containers.find(container => container.qrCode === qrCode) || null;
};

export const getItemByQRCode = async (qrCode: string): Promise<Item | null> => {
    const items = await getItems();
    return items.find(item => item.qrCode === qrCode) || null;
};

export type { Item, Container, Category } from './types';