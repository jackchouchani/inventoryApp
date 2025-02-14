import { MaterialIconName } from './icons';

export interface Category {
    id: number;
    name: string;
    description?: string;
    icon?: MaterialIconName;
    createdAt: string;
    updatedAt: string;
}

export type CategoryInput = Omit<Category, 'id' | 'createdAt' | 'updatedAt'>;
export type CategoryUpdate = Partial<Omit<Category, 'id' | 'createdAt'>>; 