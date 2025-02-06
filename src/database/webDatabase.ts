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

  async addContainer(container: Omit<Container, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const storage = this.getStorage();
    const containers = await this.getContainers();
    const newId = containers.length > 0 ? Math.max(...containers.map(c => c.id || 0)) + 1 : 1;
    const newContainer = { 
      ...container, 
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
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
        updatedAt: new Date().toISOString(),
        soldAt: status === 'sold' ? new Date().toISOString() : null
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

  public async saveDatabase(data: { 
    items: Item[], 
    containers: Container[], 
    categories: Category[] 
  }): Promise<void> {
    const storage = this.getStorage();
    storage.setItem('items', JSON.stringify(data.items));
    storage.setItem('containers', JSON.stringify(data.containers));
    storage.setItem('categories', JSON.stringify(data.categories));
  }

  async deleteContainer(containerId: number): Promise<void> {
    const storage = this.getStorage();
    const containers = await this.getContainers();
    const items = await this.getItems();
    
    const updatedContainers = containers.filter(c => c.id !== containerId);
    const updatedItems = items.map(item => 
      item.containerId === containerId 
        ? { ...item, containerId: undefined }
        : item
    );
    
    await this.saveDatabase({ 
      items: updatedItems, 
      containers: updatedContainers,
      categories: await this.getCategories()
    });
  }

  async updateContainer(containerId: number, containerData: Omit<Container, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const storage = this.getStorage();
    const containers = await this.getContainers();
    
    const updatedContainers = containers.map(container =>
      container.id === containerId
        ? { 
            ...containerData, 
            id: containerId,
            createdAt: container.createdAt,
            updatedAt: new Date().toISOString()
          }
        : container
    );
    
    await this.saveDatabase({ 
      items: await this.getItems(),
      containers: updatedContainers,
      categories: await this.getCategories()
    });
  }

  async getItemOrContainerByQRCode(type: "ITEM" | "CONTAINER", qrCode: string): Promise<boolean> {
    const items = await this.getItems();
    const containers = await this.getContainers();
    
    const foundItem = items.some(item => item.qrCode === qrCode);
    const foundContainer = containers.some(container => container.qrCode === qrCode);
    
    return foundItem || foundContainer;
  }

  async validateQRCode(qrCode: string): Promise<boolean> {
    const items = await this.getItems();
    const containers = await this.getContainers();
    
    const itemExists = items.some(item => item.qrCode === qrCode);
    const containerExists = containers.some(container => container.qrCode === qrCode);
    
    return itemExists || containerExists;
  }

  async getItemByQRCode(qrCode: string): Promise<Item | null> {
    const items = await this.getItems();
    return items.find(item => item.qrCode === qrCode) || null;
  }

  async getContainerByQRCode(qrCode: string): Promise<Container | null> {
    const containers = await this.getContainers();
    return containers.find(container => container.qrCode === qrCode) || null;
  }

  async getCategory(id: number): Promise<Category | null> {
    const categories = await this.getCategories();
    return categories.find(category => category.id === id) || null;
  }

  async updateCategory(id: number, name: string): Promise<void> {
    const storage = this.getStorage();
    const categories = await this.getCategories();
    const index = categories.findIndex(c => c.id === id);
    if (index !== -1) {
      categories[index] = { 
        ...categories[index], 
        name,
        updatedAt: new Date().toISOString()
      };
      storage.setItem('categories', JSON.stringify(categories));
    }
  }

  async deleteCategory(id: number): Promise<void> {
    const storage = this.getStorage();
    const categories = await this.getCategories();
    const updatedCategories = categories.filter(c => c.id !== id);
    storage.setItem('categories', JSON.stringify(updatedCategories));
  }
}

export default new WebDatabase();