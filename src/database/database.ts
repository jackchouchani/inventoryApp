import { Platform } from 'react-native';
import { Container, DatabaseInterface, Item } from './types';
import webDatabase from './webDatabase';
import nativeDatabase, {
  initDatabase as nativeInitDatabase,
  getItems as nativeGetItems,
  addItem as nativeAddItem,
  updateItem as nativeUpdateItem,
  getContainers as nativeGetContainers,
  getCategories as nativeGetCategories,
  resetDatabase,
  addCategory,
  addContainer,
  getDatabase,
} from './nativeDatabase';

const isWeb = Platform.OS === 'web';
const chosenDatabase = isWeb ? webDatabase : nativeDatabase;

export default chosenDatabase;

// Pour la version web, on peut faire des stubs si nécessaire
export const initDatabase = isWeb ? async () => {} : nativeInitDatabase;
export const getItems = isWeb ? webDatabase.getItems.bind(webDatabase) : nativeGetItems;
export const addItem = isWeb ? webDatabase.addItem.bind(webDatabase) : nativeAddItem;
export const updateItem = isWeb ? webDatabase.updateItem.bind(webDatabase) : nativeUpdateItem;
export const getContainers = isWeb ? webDatabase.getContainers.bind(webDatabase) : nativeGetContainers;
export const getCategories = isWeb ? webDatabase.getCategories.bind(webDatabase) : nativeGetCategories;

// Exportez également les fonctions supplémentaires utilisées par vos backups et autres
export { resetDatabase, addCategory, addContainer, getDatabase };

export const getContainerByQRCode = async (qrCode: string): Promise<Container | null> => {
    const containers = await getContainers();
    return containers.find(container => container.qrCode === qrCode) || null;
};

export const getItemByQRCode = async (qrCode: string): Promise<Item | null> => {
    const items = await getItems();
    return items.find(item => item.qrCode === qrCode) || null;
};

export * from './types';