import { DatabaseInterface, Item, Container, Category } from './types';

const WEB_PHOTO_STORAGE_KEY = 'photo_uris';

class WebDatabase implements DatabaseInterface {
  private storage: Storage | null = null;

  constructor() {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined' && window.localStorage) {
      this.storage = window.localStorage;
    }
  }

  private getStorage(): Storage {
    if (!this.storage) {
      // Fallback storage for non-browser environments
      return {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0
      } as Storage;
    }
    return this.storage;
  }

  async initDatabase(): Promise<void> {
    const storage = this.getStorage();
    if (!storage.getItem('items')) storage.setItem('items', '[]');
    if (!storage.getItem('containers')) storage.setItem('containers', '[]');
    if (!storage.getItem('categories')) storage.setItem('categories', '[]');
  }

  async getItems(): Promise<Item[]> {
    const storage = this.getStorage();
    const items = storage.getItem('items');
    return items ? JSON.parse(items) : [];
  }

  async getContainers(): Promise<Container[]> {
    const storage = this.getStorage();
    const containers = storage.getItem('containers');
    return containers ? JSON.parse(containers) : [];
  }

  async getCategories(): Promise<Category[]> {
    const storage = this.getStorage();
    const categories = storage.getItem('categories');
    return categories ? JSON.parse(categories) : [];
  }

  async addItem(item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const storage = this.getStorage();
    const items = await this.getItems();
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id || 0)) + 1 : 1;
    const newItem = { 
      ...item, 
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    items.push(newItem);
    storage.setItem('items', JSON.stringify(items));
    return newId;
  }

  async updateItem(id: number, item: Partial<Item>): Promise<void> {
    const storage = this.getStorage();
    const items = await this.getItems();
    const index = items.findIndex(i => i.id === id);
    if (index !== -1) {
      items[index] = { 
        ...items[index], 
        ...item,
        updatedAt: new Date().toISOString()
      };
      storage.setItem('items', JSON.stringify(items));
    }
  }

  async addContainer(container: Omit<Container, 'id'>): Promise<number> {
    const storage = this.getStorage();
    const containers = await this.getContainers();
    const newId = containers.length > 0 ? Math.max(...containers.map(c => c.id || 0)) + 1 : 1;
    const newContainer = { ...container, id: newId };
    containers.push(newContainer);
    storage.setItem('containers', JSON.stringify(containers));
    return newId;
  }

  async addCategory(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const storage = this.getStorage();
    const categories = await this.getCategories();
    const newId = categories.length > 0 ? Math.max(...categories.map(c => c.id || 0)) + 1 : 1;
    const newCategory = { 
      ...category, 
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    categories.push(newCategory);
    storage.setItem('categories', JSON.stringify(categories));
    return newId;
  }

  async resetDatabase(): Promise<void> {
    const storage = this.getStorage();
    storage.setItem('items', '[]');
    storage.setItem('containers', '[]');
    storage.setItem('categories', '[]');
  }

  async updateItemStatus(id: number, status: 'available' | 'sold'): Promise<void> {
    const storage = this.getStorage();
    const items = await this.getItems();
    const index = items.findIndex(i => i.id === id);
    if (index !== -1) {
      items[index] = {
        ...items[index],
        status,
        updatedAt: new Date().toISOString()
      };
      storage.setItem('items', JSON.stringify(items));
    }
  }

  async storePhotoUri(uri: string): Promise<void> {
    const storage = this.getStorage();
    const uris = JSON.parse(storage.getItem(WEB_PHOTO_STORAGE_KEY) || '[]');
    uris.push(uri);
    storage.setItem(WEB_PHOTO_STORAGE_KEY, JSON.stringify(uris));
  }

  async getPhotoUris(): Promise<string[]> {
    const storage = this.getStorage();
    return JSON.parse(storage.getItem(WEB_PHOTO_STORAGE_KEY) || '[]');
  }

  async removePhotoUri(uri: string): Promise<void> {
    const storage = this.getStorage();
    const uris = JSON.parse(storage.getItem(WEB_PHOTO_STORAGE_KEY) || '[]');
    const filteredUris = uris.filter((storedUri: string) => storedUri !== uri);
    storage.setItem(WEB_PHOTO_STORAGE_KEY, JSON.stringify(filteredUris));
  }

  getDatabase(): any {
    return this.getStorage();
  }
}

export default new WebDatabase();