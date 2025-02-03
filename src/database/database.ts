import * as SQLite from 'expo-sqlite';

// Updated type definitions
type SQLiteDatabase = SQLite.SQLiteDatabase;
type SQLiteRunResult = {
  insertId: number;
  rowsAffected: number;
};

// Add this near the top of your file with other utility functions
export const formatDate = (date: Date = new Date()): string => {
    return date.toISOString().slice(0, 19).replace('T', ' ');
};


// Type definitions
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

let db: SQLiteDatabase;

try {
    db = SQLite.openDatabaseSync('vintage_store.db');
} catch (error) {
    console.error('Error opening database:', error);
    throw error;
}
export const getDatabase = (): SQLiteDatabase => {
    if (!db) {
        throw new Error('Database not initialized');
    }
    return db;
};

export const initDatabase = async () => {
  try {
    const db = getDatabase();
    
    // Create categories table with description column
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // Create containers table with qrCode column
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS containers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        qrCode TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // Create items table with qrCode column
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        purchasePrice REAL NOT NULL,
        sellingPrice REAL NOT NULL,
        status TEXT NOT NULL,
        photoUri TEXT NULL,
        qrCode TEXT NOT NULL,
        containerId INTEGER NOT NULL,
        categoryId INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (containerId) REFERENCES containers (id),
        FOREIGN KEY (categoryId) REFERENCES categories (id)
      )
    `);
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Example of updated CRUD operation
export const addCategory = async (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> => {
    try {
        const now = formatDate();
        const result = await db.runAsync(
            'INSERT INTO categories (name, description, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
            [category.name, category.description || null, now, now]
        );
        return result.lastInsertRowId;
    } catch (error) {
        console.error('Error adding category:', error);
        throw error;
    }
};

export const getCategory = async (id: number): Promise<Category | null> => {
    try {
        const result = await db.getFirstAsync<Category>(
            'SELECT * FROM categories WHERE id = ?',
            [id]
        );
        return result || null;
    } catch (error) {
        console.error('Error getting category:', error);
        throw error;
    }
};

export const updateCategory = async (id: number, name: string): Promise<void> => {
    try {
        const now = formatDate();
        await db.runAsync(
            'UPDATE categories SET name = ?, updatedAt = ? WHERE id = ?',
            [name, now, id]
        );
    } catch (error) {
        console.error('Error updating category:', error);
        throw error;
    }
};

export const deleteCategory = async (id: number): Promise<void> => {
    try {
        await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
    } catch (error) {
        console.error('Error deleting category:', error);
        throw error;
    }
};

export const addItem = async (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> => {
    const now = formatDate();
    const result = await db.runAsync(
        `INSERT INTO items (
            name, 
            description, 
            purchasePrice, 
            sellingPrice, 
            status,
            photoUri, 
            qrCode, 
            categoryId, 
            containerId, 
            createdAt, 
            updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            item.name,
            item.description || '',
            item.purchasePrice,
            item.sellingPrice,
            item.status,
            item.photoUri || '',
            item.qrCode,
            item.categoryId || 0,
            item.containerId || 0,
            now,
            now
        ]
    );
    return result.lastInsertRowId;
};

export const updateItem = async (id: number, item: Omit<Item, 'id'>): Promise<void> => {
    try {
        const now = formatDate();
        await db.runAsync(
            'UPDATE items SET name = ?, purchasePrice = ?, sellingPrice = ?, status = ?, photoUri = ?, qrCode = ?, containerId = ?, categoryId = ?, updatedAt = ? WHERE id = ?',
            [
                item.name,
                item.purchasePrice,
                item.sellingPrice,
                item.status,
                item.photoUri || '',
                item.qrCode,
                item.containerId || 0,
                item.categoryId || 0,
                now,
                id
            ]
        );
    } catch (error) {
        console.error('Error updating item:', error);
        throw error;
    }
};

export const updateItemStatus = async (id: number, status: Item['status']): Promise<void> => {
    try {
        const now = formatDate();
        await db.runAsync(
            'UPDATE items SET status = ?, updatedAt = ? WHERE id = ?',
            [status, now, id]
        );
    } catch (error) {
        console.error('Error updating item status:', error);
        throw error;
    }
};

export const getContainers = async (): Promise<Container[]> => {
    try {
        return await db.getAllAsync<Container>('SELECT * FROM containers');
    } catch (error) {
        console.error('Error getting containers:', error);
        throw error;
    }
};

export const getCategories = async (): Promise<Category[]> => {
    try {
        return await db.getAllAsync<Category>('SELECT * FROM categories');
    } catch (error) {
        console.error('Error getting categories:', error);
        throw error;
    }
};

export const addContainer = async (container: Omit<Container, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> => {
    try {
        const now = formatDate();
        const result = await db.runAsync(
            'INSERT INTO containers (number, name, description, qrCode, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
            [container.number, container.name, container.description || null, container.qrCode, now, now]
        );
        return result.lastInsertRowId;
    } catch (error) {
        console.error('Error adding container:', error);
        throw error;
    }
};

export const getItems = async (): Promise<Item[]> => {
    try {
        const result = await db.getAllAsync<Item>('SELECT * FROM items');
        return result;
    } catch (error) {
        console.error('Error fetching items:', error);
        throw error;
    }
};

export const resetDatabase = async () => {
  try {
    const db = getDatabase();
    
    // Drop existing tables if they exist
    await db.runAsync('DROP TABLE IF EXISTS items');
    await db.runAsync('DROP TABLE IF EXISTS containers');
    await db.runAsync('DROP TABLE IF EXISTS categories');
    
    // Reinitialize the database with fresh tables
    await initDatabase();
    
    console.log('Database reset successfully');
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  }
};

export const validateQRCode = async (type: 'ITEM' | 'CONTAINER', qrCode: string): Promise<boolean> => {
  try {
    let result;
    if (type === 'ITEM') {
      result = await db.getFirstAsync(
        'SELECT id FROM items WHERE qrCode = ?',
        [qrCode]
      );
    } else {
      result = await db.getFirstAsync(
        'SELECT id FROM containers WHERE qrCode = ?',
        [qrCode]
      );
    }
    return result !== undefined;
  } catch (error) {
    console.error('Error validating QR code:', error);
    throw error;
  }
};

export const getItemByQRCode = async (qrCode: string): Promise<Item | null> => {
  try {
    const result = await db.getFirstAsync<Item>(
      'SELECT * FROM items WHERE qrCode = ?',
      [qrCode]
    );
    return result || null;
  } catch (error) {
    console.error('Error getting item by QR code:', error);
    throw error;
  }
};

export const getContainerByQRCode = async (qrCode: string): Promise<Container | null> => {
  try {
    const result = await db.getFirstAsync<Container>(
      'SELECT * FROM containers WHERE qrCode = ?',
      [qrCode]
    );
    return result || null;
  } catch (error) {
    console.error('Error getting container by QR code:', error);
    throw error;
  }
};
