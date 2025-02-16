import { useQuery } from '@tanstack/react-query';
import { database } from '../database/database';
import type { Item } from '../types/item';

export const useItems = () => {
    return useQuery<Item[]>({
        queryKey: ['items'],
        queryFn: () => database.getItems()
    });
}; 