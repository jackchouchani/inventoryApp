export interface Category {
    id: number;
    name: string;
    description?: string;
    icon?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export type CategoryInput = Omit<Category, 'id' | 'createdAt' | 'updatedAt'>;
export type CategoryUpdate = Partial<Omit<Category, 'id' | 'createdAt'>>; 