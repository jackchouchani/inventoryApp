import { useQuery } from '@tanstack/react-query';
import { database } from '../database/database';
import type { Container } from '../database/database';

export const useContainers = () => {
    return useQuery<Container[]>({
        queryKey: ['containers'],
        queryFn: () => database.getContainers()
    });
}; 