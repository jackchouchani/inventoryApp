import { DatabaseInterface, Item, Container, Category } from './types';

class WebDatabase implements DatabaseInterface {
  private storage: Storage;

  constructor() {
    if (typeof window !== 'undefined') {
      this.storage = window.localStorage;
    } else {
      // Créer un storage vide pour l'environnement non-web
      this.storage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        length: 0,
        key: () => null,
      };
    }
    this.initializeStorage();
  }

  private initializeStorage() {
    if (!this.storage.getItem('items')) this.storage.setItem('items', '[]');
    if (!this.storage.getItem('containers')) this.storage.setItem('containers', '[]');
    if (!this.storage.getItem('categories')) this.storage.setItem('categories', '[]');
  }

  async getItems(): Promise<Item[]> {
    return JSON.parse(this.storage.getItem('items') || '[]');
  }

  async getContainers(): Promise<Container[]> {
    return JSON.parse(this.storage.getItem('containers') || '[]');
  }

  async getCategories(): Promise<Category[]> {
    return JSON.parse(this.storage.getItem('categories') || '[]');
  }

  async addItem(item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const items = await this.getItems();
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id || 0)) + 1 : 1;
    items.push({ ...item, id: newId });
    this.storage.setItem('items', JSON.stringify(items));
    return newId;
  }

  async updateItem(id: number, item: Omit<Item, 'id'>): Promise<void> {
    const items = await this.getItems();
    const index = items.findIndex(i => i.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...item };
      this.storage.setItem('items', JSON.stringify(items));
    }
  }
}

export default new WebDatabase();