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
  soldAt?: string | null;
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
  initDatabase: () => Promise<void>;
  getItems: () => Promise<Item[]>;
  getContainers: () => Promise<Container[]>;
  getCategories: () => Promise<Category[]>;
  addItem: (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>) => Promise<number>;
  updateItem: (id: number, item: Omit<Item, 'id'>) => Promise<void>;
  updateItemStatus: (id: number, status: Item['status']) => Promise<void>;
  addContainer: (container: Omit<Container, 'id' | 'createdAt' | 'updatedAt'>) => Promise<number>;
  addCategory: (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => Promise<number>;
  resetDatabase: () => Promise<void>;
  getDatabase: () => any;
  deleteContainer: (containerId: number) => Promise<void>;
  updateContainer: (containerId: number, containerData: Omit<Container, 'id'>) => Promise<void>;
  getItemOrContainerByQRCode: (type: 'ITEM' | 'CONTAINER', qrCode: string) => Promise<boolean>;
  validateQRCode: (type: 'ITEM' | 'CONTAINER', qrCode: string) => Promise<boolean>;
  getItemByQRCode: (qrCode: string) => Promise<Item | null>;
  getContainerByQRCode: (qrCode: string) => Promise<Container | null>;
  getCategory: (id: number) => Promise<Category | null>;
  updateCategory: (id: number, name: string) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  storePhotoUri: (uri: string) => Promise<void>;
  getPhotoUris: () => Promise<string[]>;
  removePhotoUri: (uri: string) => Promise<void>;
  saveDatabase: (data: {
    items: Item[],
    containers: Container[],
    categories: Category[]
  }) => Promise<void>;
}