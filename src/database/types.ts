export interface Item {
  id?: number;
  name: string;
  purchasePrice: number;
  sellingPrice: number;
  status: 'available' | 'sold';
  photoUri?: string;
  containerId?: number;
  categoryId?: number;
  qrCode: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Container {
  id?: number;
  number: number;
  name: string;
  description?: string;
  qrCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id?: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseInterface {
  initDatabase(): Promise<void>;
  getItems(): Promise<Item[]>;
  getContainers(): Promise<Container[]>;
  getCategories(): Promise<Category[]>;
  addItem(item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<number>;
  updateItem(id: number, item: Partial<Item>): Promise<void>;
  updateItemStatus(id: number, status: 'available' | 'sold'): Promise<void>;
  addContainer(container: Omit<Container, 'id' | 'createdAt' | 'updatedAt'>): Promise<number>;
  addCategory(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<number>;
  resetDatabase(): Promise<void>;
  getDatabase(): any;
} 