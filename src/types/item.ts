export interface Item {
    id: number;
    name: string;
    description?: string;
    purchasePrice: number;
    sellingPrice: number;
    status: 'available' | 'sold';
    photo_storage_url?: string;
    containerId?: number | null;
    categoryId?: number;
    qrCode: string;
    createdAt: string;
    updatedAt: string;
    soldAt?: string;
}

export type ItemInput = Omit<Item, 'id' | 'createdAt' | 'updatedAt'>;
export type ItemUpdate = Partial<ItemInput>; 