import { useState, useEffect, useCallback } from 'react';
import algoliasearch from 'algoliasearch';
import { ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY, INDEX_NAME } from '../config/algolia';
import type { Item } from '../types/item';

// Initialisation du client Algolia
let searchClient: any;
try {
  if (ALGOLIA_APP_ID && ALGOLIA_SEARCH_API_KEY) {
    searchClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY);
  }
} catch (error) {
  console.error('Erreur lors de l\'initialisation du client Algolia:', error);
  searchClient = null;
}

export const useSimilarItems = (itemId: number | string, maxRecommendations: number = 3) => {
  const [similarItems, setSimilarItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSimilarItems = useCallback(async () => {
    if (!itemId || !searchClient) {
      console.warn('useSimilarItems: itemId manquant ou searchClient non initialisé');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Récupération d\'articles similaires pour l\'item:', itemId);
      
      // Utilisation de l'API Algolia Recommendations
      const requestOptions = {
        indexName: INDEX_NAME,
        objectID: String(itemId), // S'assurer que l'objectID est une string
        model: 'looking-similar',
        threshold: 0,
        maxRecommendations
      };

      const response = await searchClient.getRecommendations([requestOptions]);

      if (response && response.results && response.results[0] && response.results[0].hits) {
        const similar = response.results[0].hits;
        console.log(`Articles similaires trouvés: ${similar.length}`);
        setSimilarItems(similar);
      } else {
        console.log('Aucun article similaire trouvé');
        setSimilarItems([]);
      }
    } catch (e) {
      console.error('Erreur lors de la récupération des articles similaires:', e);
      setError('Erreur lors de la récupération des articles similaires.');
      setSimilarItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [itemId, maxRecommendations]);

  useEffect(() => {
    if (itemId) {
      fetchSimilarItems();
    }
  }, [fetchSimilarItems]);

  const transformToItem = useCallback((algoliaItem: any): Item => {
    return {
      id: Number(algoliaItem.objectID),
      name: algoliaItem.name || '',
      description: algoliaItem.description || '',
      purchasePrice: typeof algoliaItem.purchase_price === 'string' 
        ? parseFloat(algoliaItem.purchase_price) 
        : (algoliaItem.purchase_price || 0),
      sellingPrice: typeof algoliaItem.selling_price === 'string' 
        ? parseFloat(algoliaItem.selling_price) 
        : (algoliaItem.selling_price || 0),
      status: algoliaItem.status || 'available',
      photo_storage_url: algoliaItem.photo_storage_url || undefined,
      qrCode: algoliaItem.qr_code || undefined,
      categoryId: algoliaItem.category_id || undefined,
      containerId: algoliaItem.container_id || null,
      createdAt: algoliaItem.created_at || new Date().toISOString(),
      updatedAt: algoliaItem.updated_at || new Date().toISOString(),
      soldAt: algoliaItem.sold_at || undefined
    };
  }, []);

  const transformedItems = similarItems.map(transformToItem);

  return {
    similarItems: transformedItems,
    rawSimilarItems: similarItems,
    isLoading,
    error,
    refetch: fetchSimilarItems
  };
}; 