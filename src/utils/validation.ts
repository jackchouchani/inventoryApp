import type { Category } from '../types/category';
import * as z from 'zod';

export const validateItemName = (name: string): boolean => {
    return name.trim().length >= 3 && name.trim().length <= 100;
};

export const validatePrice = (price: number): boolean => {
    return !isNaN(price) && price >= 0 && price <= 1000000;
};

export const validateCategory = (category: Category): boolean => {
    if (!category) return false;
    if (!category.name || typeof category.name !== 'string') return false;
    if (category.name.trim().length < 3 || category.name.trim().length > 50) return false;
    if (category.description && typeof category.description !== 'string') return false;
    if (category.description && category.description.length > 200) return false;
    if (category.icon && typeof category.icon !== 'string') return false;
    return true;
};

export const priceRangeSchema = z.object({
  min: z.number().min(0).optional(),
  max: z.number().min(0).optional(),
}).refine(data => {
  if (data.min && data.max) {
    return data.min <= data.max;
  }
  return true;
}, {
  message: "Le prix minimum doit être inférieur ou égal au prix maximum"
});

export const searchSchema = z.string().max(100);

export const itemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  purchasePrice: z.number().min(0),
  sellingPrice: z.number().min(0),
  status: z.enum(['available', 'sold']),
  categoryId: z.number().optional(),
  containerId: z.number().optional(),
  quantity: z.number().min(1).default(1),
});

export type PriceRange = z.infer<typeof priceRangeSchema>;
export type ItemValidation = z.infer<typeof itemSchema>; 