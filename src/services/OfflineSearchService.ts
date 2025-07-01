import { localDB } from '../database/localDatabase';
import { supabase } from '../config/supabase';
import Fuse from 'fuse.js';

interface SearchOptions {
  includeScore?: boolean;
  threshold?: number;
  keys?: string[];
  limit?: number;
  offset?: number;
}

interface SearchResult<T> {
  items: T[];
  total: number;
  fromCache: boolean;
  searchTime: number;
}

export class OfflineSearchService {
  private static instance: OfflineSearchService;
  private searchIndex: Map<string, Fuse<any>> = new Map();
  private lastIndexUpdate: Date = new Date(0);
  private readonly INDEX_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.initializeSearchIndex();
  }

  public static getInstance(): OfflineSearchService {
    if (!OfflineSearchService.instance) {
      OfflineSearchService.instance = new OfflineSearchService();
    }
    return OfflineSearchService.instance;
  }

  /**
   * Rechercher des items par différents critères
   */
  async searchItems(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<any>> {
    const startTime = performance.now();
    const isOnline = await this.isOnline();
    
    try {
      // En mode online, essayer d'abord Supabase puis fallback local
      if (isOnline && !this.shouldUseOfflineFirst()) {
        try {
          const onlineResult = await this.searchItemsOnline(query, options);
          return {
            ...onlineResult,
            searchTime: performance.now() - startTime
          };
        } catch (error) {
          console.warn('[OfflineSearchService] Recherche online échouée, fallback offline:', error);
        }
      }
      
      // Recherche offline dans IndexedDB
      const offlineResult = await this.searchItemsOffline(query, options);
      return {
        ...offlineResult,
        searchTime: performance.now() - startTime
      };
      
    } catch (error) {
      console.error('[OfflineSearchService] Erreur lors de la recherche items:', error);
      return {
        items: [],
        total: 0,
        fromCache: true,
        searchTime: performance.now() - startTime
      };
    }
  }

  /**
   * Rechercher des containers par QR code ou nom
   */
  async searchContainers(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<any>> {
    const startTime = performance.now();
    const isOnline = await this.isOnline();
    
    try {
      // En mode online, essayer d'abord Supabase
      if (isOnline && !this.shouldUseOfflineFirst()) {
        try {
          const onlineResult = await this.searchContainersOnline(query, options);
          return {
            ...onlineResult,
            searchTime: performance.now() - startTime
          };
        } catch (error) {
          console.warn('[OfflineSearchService] Recherche containers online échouée, fallback offline:', error);
        }
      }
      
      // Recherche offline
      const offlineResult = await this.searchContainersOffline(query, options);
      return {
        ...offlineResult,
        searchTime: performance.now() - startTime
      };
      
    } catch (error) {
      console.error('[OfflineSearchService] Erreur lors de la recherche containers:', error);
      return {
        items: [],
        total: 0,
        fromCache: true,
        searchTime: performance.now() - startTime
      };
    }
  }

  /**
   * Rechercher des catégories
   */
  async searchCategories(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<any>> {
    const startTime = performance.now();
    
    try {
      // Les catégories sont généralement peu nombreuses, chercher offline
      const offlineResult = await this.searchCategoriesOffline(query, options);
      return {
        ...offlineResult,
        searchTime: performance.now() - startTime
      };
      
    } catch (error) {
      console.error('[OfflineSearchService] Erreur lors de la recherche categories:', error);
      return {
        items: [],
        total: 0,
        fromCache: true,
        searchTime: performance.now() - startTime
      };
    }
  }

  /**
   * Rechercher par QR Code spécifiquement (pour le scanner)
   */
  async findByQRCode(
    qrCode: string,
    entityType?: 'item' | 'container' | 'category'
  ): Promise<{
    found: boolean;
    type?: 'item' | 'container' | 'category';
    data?: any;
    fromCache: boolean;
  }> {
    try {
      console.log(`[OfflineSearchService] Recherche QR Code: ${qrCode}`);
      
      // D'abord chercher offline dans IndexedDB
      const offlineResult = await this.findByQRCodeOffline(qrCode, entityType);
      
      if (offlineResult.found) {
        console.log(`[OfflineSearchService] QR Code trouvé offline:`, offlineResult);
        return offlineResult;
      }
      
      // Si pas trouvé offline et qu'on est online, chercher sur le serveur
      if (await this.isOnline()) {
        const onlineResult = await this.findByQRCodeOnline(qrCode, entityType);
        
        if (onlineResult.found) {
          // Sauvegarder en cache local pour la prochaine fois
          await this.cacheEntity(onlineResult.type!, onlineResult.data);
          console.log(`[OfflineSearchService] QR Code trouvé online et mis en cache:`, onlineResult);
          return onlineResult;
        }
      }
      
      console.log(`[OfflineSearchService] QR Code non trouvé: ${qrCode}`);
      return {
        found: false,
        fromCache: true
      };
      
    } catch (error) {
      console.error('[OfflineSearchService] Erreur lors de la recherche par QR Code:', error);
      return {
        found: false,
        fromCache: true
      };
    }
  }

  /**
   * Recherche d'items offline dans IndexedDB
   */
  private async searchItemsOffline(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult<any>> {
    const { limit = 50, offset = 0 } = options;
    
    if (!query.trim()) {
      // Retourner tous les items si pas de query
      const allItems = await localDB.items
        .offset(offset)
        .limit(limit)
        .toArray();
      
      const total = await localDB.items.count();
      
      return {
        items: allItems,
        total,
        fromCache: true,
        searchTime: 0
      };
    }
    
    // Recherche par QR Code exact d'abord
    if (query.length > 5) {
      const exactMatch = await localDB.items.where('qrCode').equals(query).first();
      if (exactMatch) {
        return {
          items: [exactMatch],
          total: 1,
          fromCache: true,
          searchTime: 0
        };
      }
    }
    
    // Recherche textuelle avec Fuse.js
    await this.ensureSearchIndexUpdated();
    const fuse = this.searchIndex.get('items');
    
    if (fuse) {
      const results = fuse.search(query, { limit });
      return {
        items: results.map(r => r.item),
        total: results.length,
        fromCache: true,
        searchTime: 0
      };
    }
    
    // Fallback: recherche simple par nom
    const items = await localDB.items
      .filter(item => 
        (item.name?.toLowerCase() || '').includes(query.toLowerCase()) ||
        (item.description?.toLowerCase() || '').includes(query.toLowerCase())
      )
      .offset(offset)
      .limit(limit)
      .toArray();
    
    return {
      items,
      total: items.length,
      fromCache: true,
      searchTime: 0
    };
  }

  /**
   * Recherche de containers offline
   */
  private async searchContainersOffline(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult<any>> {
    const { limit = 50, offset = 0 } = options;
    
    // Recherche par QR Code exact d'abord
    const exactMatch = await localDB.containers.where('qrCode').equals(query).first();
    if (exactMatch) {
      return {
        items: [exactMatch],
        total: 1,
        fromCache: true,
        searchTime: 0
      };
    }
    
    // Recherche par numéro de container
    if (!isNaN(Number(query))) {
      const numberMatch = await localDB.containers.where('number').equals(Number(query)).first();
      if (numberMatch) {
        return {
          items: [numberMatch],
          total: 1,
          fromCache: true,
          searchTime: 0
        };
      }
    }
    
    // Recherche textuelle
    const containers = await localDB.containers
      .filter(container => 
        (container.name?.toLowerCase() || '').includes(query.toLowerCase()) ||
        (container.description?.toLowerCase() || '').includes(query.toLowerCase())
      )
      .offset(offset)
      .limit(limit)
      .toArray();
    
    return {
      items: containers,
      total: containers.length,
      fromCache: true,
      searchTime: 0
    };
  }

  /**
   * Recherche de catégories offline
   */
  private async searchCategoriesOffline(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult<any>> {
    const { limit = 50, offset = 0 } = options;
    
    const categories = await localDB.categories
      .filter(category => 
        (category.name?.toLowerCase() || '').includes(query.toLowerCase()) ||
        (category.description?.toLowerCase() || '').includes(query.toLowerCase())
      )
      .offset(offset)
      .limit(limit)
      .toArray();
    
    return {
      items: categories,
      total: categories.length,
      fromCache: true,
      searchTime: 0
    };
  }

  /**
   * Recherche par QR Code offline
   */
  private async findByQRCodeOffline(
    qrCode: string,
    entityType?: string
  ): Promise<{
    found: boolean;
    type?: 'item' | 'container' | 'category';
    data?: any;
    fromCache: boolean;
  }> {
    // Chercher dans les items
    if (!entityType || entityType === 'item') {
      const item = await localDB.items.where('qrCode').equals(qrCode).first();
      if (item) {
        return {
          found: true,
          type: 'item',
          data: item,
          fromCache: true
        };
      }
    }
    
    // Chercher dans les containers
    if (!entityType || entityType === 'container') {
      const container = await localDB.containers.where('qrCode').equals(qrCode).first();
      if (container) {
        return {
          found: true,
          type: 'container',
          data: container,
          fromCache: true
        };
      }
    }
    
    // Chercher dans les catégories (si elles ont des QR codes)
    if (!entityType || entityType === 'category') {
      const category = await localDB.categories.where('qrCode').equals(qrCode).first();
      if (category) {
        return {
          found: true,
          type: 'category',
          data: category,
          fromCache: true
        };
      }
    }
    
    return {
      found: false,
      fromCache: true
    };
  }

  /**
   * Recherche online avec Supabase
   */
  private async searchItemsOnline(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult<any>> {
    const { limit = 50, offset = 0 } = options;
    
    let supabaseQuery = supabase
      .from('items')
      .select('*', { count: 'exact' });
    
    if (query.trim()) {
      supabaseQuery = supabaseQuery.or(
        `name.ilike.%${query}%,description.ilike.%${query}%,qr_code.eq.${query}`
      );
    }
    
    const { data, error, count } = await supabaseQuery
      .range(offset, offset + limit - 1);
    
    if (error) {
      throw new Error(`Erreur recherche online: ${error.message}`);
    }
    
    // Convertir snake_case vers camelCase
    const items = (data || []).map(item => this.convertServerToLocal(item));
    
    return {
      items,
      total: count || 0,
      fromCache: false,
      searchTime: 0
    };
  }

  /**
   * Recherche containers online
   */
  private async searchContainersOnline(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult<any>> {
    const { limit = 50, offset = 0 } = options;
    
    let supabaseQuery = supabase
      .from('containers')
      .select('*', { count: 'exact' });
    
    if (query.trim()) {
      supabaseQuery = supabaseQuery.or(
        `name.ilike.%${query}%,description.ilike.%${query}%,qr_code.eq.${query},number.eq.${query}`
      );
    }
    
    const { data, error, count } = await supabaseQuery
      .range(offset, offset + limit - 1);
    
    if (error) {
      throw new Error(`Erreur recherche containers online: ${error.message}`);
    }
    
    const containers = (data || []).map(container => this.convertServerToLocal(container));
    
    return {
      items: containers,
      total: count || 0,
      fromCache: false,
      searchTime: 0
    };
  }

  /**
   * Recherche par QR Code online
   */
  private async findByQRCodeOnline(
    qrCode: string,
    entityType?: string
  ): Promise<{
    found: boolean;
    type?: 'item' | 'container' | 'category';
    data?: any;
    fromCache: boolean;
  }> {
    const searches = [];
    
    if (!entityType || entityType === 'item') {
      searches.push(
        supabase.from('items').select('*').eq('qr_code', qrCode).single()
          .then(({ data, error }) => ({ type: 'item', data, error }))
      );
    }
    
    if (!entityType || entityType === 'container') {
      searches.push(
        supabase.from('containers').select('*').eq('qr_code', qrCode).single()
          .then(({ data, error }) => ({ type: 'container', data, error }))
      );
    }
    
    if (!entityType || entityType === 'category') {
      searches.push(
        supabase.from('categories').select('*').eq('qr_code', qrCode).single()
          .then(({ data, error }) => ({ type: 'category', data, error }))
      );
    }
    
    const results = await Promise.allSettled(searches);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.data && !result.value.error) {
        return {
          found: true,
          type: result.value.type as any,
          data: this.convertServerToLocal(result.value.data),
          fromCache: false
        };
      }
    }
    
    return {
      found: false,
      fromCache: false
    };
  }

  /**
   * Mettre en cache une entité trouvée online
   */
  private async cacheEntity(type: 'item' | 'container' | 'category', data: any): Promise<void> {
    try {
      const localData = {
        ...data,
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      };
      
      switch (type) {
        case 'item':
          await localDB.items.put(localData);
          break;
        case 'container':
          await localDB.containers.put(localData);
          break;
        case 'category':
          await localDB.categories.put(localData);
          break;
      }
      
      console.log(`[OfflineSearchService] ${type} mis en cache:`, data.id);
    } catch (error) {
      console.error(`[OfflineSearchService] Erreur mise en cache ${type}:`, error);
    }
  }

  /**
   * Initialiser l'index de recherche Fuse.js
   */
  private async initializeSearchIndex(): Promise<void> {
    try {
      await this.updateSearchIndex();
    } catch (error) {
      console.error('[OfflineSearchService] Erreur initialisation index de recherche:', error);
    }
  }

  /**
   * Mettre à jour l'index de recherche
   */
  private async updateSearchIndex(): Promise<void> {
    try {
      console.log('[OfflineSearchService] Mise à jour de l\'index de recherche...');
      
      // Index pour les items
      const items = await localDB.items.toArray();
      const itemsFuse = new Fuse(items, {
        keys: ['name', 'description', 'qrCode'],
        threshold: 0.3,
        includeScore: true
      });
      this.searchIndex.set('items', itemsFuse);
      
      // Index pour les containers
      const containers = await localDB.containers.toArray();
      const containersFuse = new Fuse(containers, {
        keys: ['name', 'description', 'qrCode', 'number'],
        threshold: 0.3,
        includeScore: true
      });
      this.searchIndex.set('containers', containersFuse);
      
      // Index pour les catégories
      const categories = await localDB.categories.toArray();
      const categoriesFuse = new Fuse(categories, {
        keys: ['name', 'description'],
        threshold: 0.3,
        includeScore: true
      });
      this.searchIndex.set('categories', categoriesFuse);
      
      this.lastIndexUpdate = new Date();
      console.log('[OfflineSearchService] Index de recherche mis à jour');
      
    } catch (error) {
      console.error('[OfflineSearchService] Erreur mise à jour index:', error);
    }
  }

  /**
   * S'assurer que l'index est à jour
   */
  private async ensureSearchIndexUpdated(): Promise<void> {
    const now = new Date();
    const timeSinceUpdate = now.getTime() - this.lastIndexUpdate.getTime();
    
    if (timeSinceUpdate > this.INDEX_REFRESH_INTERVAL) {
      await this.updateSearchIndex();
    }
  }

  /**
   * Convertir les données serveur au format local
   */
  private convertServerToLocal(serverData: any): any {
    const localData = { ...serverData };
    
    // Convertir snake_case vers camelCase
    if (localData.container_id !== undefined) {
      localData.containerId = localData.container_id;
      delete localData.container_id;
    }
    
    if (localData.category_id !== undefined) {
      localData.categoryId = localData.category_id;
      delete localData.category_id;
    }
    
    if (localData.location_id !== undefined) {
      localData.locationId = localData.location_id;
      delete localData.location_id;
    }
    
    if (localData.purchase_price !== undefined) {
      localData.purchasePrice = localData.purchase_price;
      delete localData.purchase_price;
    }
    
    if (localData.selling_price !== undefined) {
      localData.sellingPrice = localData.selling_price;
      delete localData.selling_price;
    }
    
    if (localData.qr_code !== undefined) {
      localData.qrCode = localData.qr_code;
      delete localData.qr_code;
    }
    
    if (localData.created_at !== undefined) {
      localData.createdAt = localData.created_at;
      delete localData.created_at;
    }
    
    if (localData.updated_at !== undefined) {
      localData.updatedAt = localData.updated_at;
      delete localData.updated_at;
    }
    
    return localData;
  }

  /**
   * Méthodes utilitaires
   */
  private async isOnline(): Promise<boolean> {
    try {
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private shouldUseOfflineFirst(): boolean {
    // Logique pour décider si on doit privilégier l'offline
    // Par exemple, si l'utilisateur a activé le mode "offline forcé"
    return localStorage.getItem('force_offline_mode') === 'true';
  }

  /**
   * Méthodes publiques de gestion
   */
  async refreshSearchIndex(): Promise<void> {
    await this.updateSearchIndex();
  }

  async clearSearchCache(): Promise<void> {
    this.searchIndex.clear();
    this.lastIndexUpdate = new Date(0);
  }

  getSearchStats(): {
    indexLastUpdated: Date;
    indexedItems: number;
    indexedContainers: number;
    indexedCategories: number;
  } {
    const itemsFuse = this.searchIndex.get('items');
    const containersFuse = this.searchIndex.get('containers');
    const categoriesFuse = this.searchIndex.get('categories');
    
    return {
      indexLastUpdated: this.lastIndexUpdate,
      indexedItems: itemsFuse ? (itemsFuse as any)._docs?.length || 0 : 0,
      indexedContainers: containersFuse ? (containersFuse as any)._docs?.length || 0 : 0,
      indexedCategories: categoriesFuse ? (categoriesFuse as any)._docs?.length || 0 : 0
    };
  }
}

// Export de l'instance singleton
export const offlineSearchService = OfflineSearchService.getInstance();