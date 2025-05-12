/**
 * Constantes pour les clés de requête utilisées avec React Query
 */
export const QUERY_KEYS = {
  INVENTORY: 'inventory',
  ITEMS: 'items',
  CATEGORIES: 'categories',
  CONTAINERS: 'containers',
  ITEM_DETAILS: (id: number) => ['items', id],
  CONTAINER_ITEMS: (containerId: number) => ['containers', containerId, 'items'],
  CATEGORY_ITEMS: (categoryId: number) => ['categories', categoryId, 'items'],
  SCANS: 'scans',
  STATS: 'stats'
} as const; 