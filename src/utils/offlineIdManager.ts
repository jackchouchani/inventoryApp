import { localDB } from '../database/localDatabase';
import { v4 as uuidv4 } from 'uuid';

interface IdMapping {
  id: string;
  tempId: string;
  realId: number;
  entity: 'item' | 'category' | 'container' | 'location';
  createdAt: Date;
  syncedAt: Date;
}

export class OfflineIdManager {
  private static instance: OfflineIdManager;
  private mappings = new Map<string, IdMapping>();
  private readonly ID_MAPPING_STORE = 'id-mappings';

  private constructor() {
    this.loadMappings();
  }

  public static getInstance(): OfflineIdManager {
    if (!OfflineIdManager.instance) {
      OfflineIdManager.instance = new OfflineIdManager();
    }
    return OfflineIdManager.instance;
  }

  /**
   * Générer un ID temporaire pour les créations offline
   */
  generateOfflineId(entity: 'item' | 'category' | 'container' | 'location'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `offline_${entity}_${timestamp}_${random}`;
  }

  /**
   * Vérifier si un ID est un ID offline
   */
  isOfflineId(id: string | number): boolean {
    return typeof id === 'string' && id.startsWith('offline_');
  }

  /**
   * Créer un mapping temporaire vers réel
   */
  async createMapping(
    tempId: string,
    realId: number,
    entity: 'item' | 'category' | 'container' | 'location'
  ): Promise<boolean> {
    try {
      const mapping: IdMapping = {
        id: uuidv4(),
        tempId,
        realId,
        entity,
        createdAt: new Date(),
        syncedAt: new Date()
      };

      // Sauvegarder dans IndexedDB
      await this.saveMappingToDB(mapping);
      
      // Ajouter au cache en mémoire
      this.mappings.set(tempId, mapping);
      
      console.log('[IdManager] Mapping créé:', { tempId, realId, entity });
      
      // Mettre à jour toutes les références dans les entités locales
      await this.updateReferences(tempId, realId, entity);
      
      return true;
    } catch (error) {
      console.error('[IdManager] Erreur lors de la création du mapping:', error);
      return false;
    }
  }

  /**
   * Récupérer l'ID réel à partir d'un ID temporaire
   */
  getRealId(tempId: string): number | null {
    const mapping = this.mappings.get(tempId);
    return mapping ? mapping.realId : null;
  }

  /**
   * Récupérer l'ID temporaire à partir d'un ID réel
   */
  getTempId(realId: number, entity: 'item' | 'category' | 'container' | 'location'): string | null {
    for (const [tempId, mapping] of this.mappings) {
      if (mapping.realId === realId && mapping.entity === entity) {
        return tempId;
      }
    }
    return null;
  }

  /**
   * Résoudre un ID (retourner l'ID réel si mapping existe, sinon l'ID original)
   */
  resolveId(id: string | number): number | string {
    if (typeof id === 'string' && this.isOfflineId(id)) {
      const realId = this.getRealId(id);
      return realId !== null ? realId : id;
    }
    return id;
  }

  /**
   * Récupérer tous les mappings pour une entité
   */
  getMappingsForEntity(entity: 'item' | 'category' | 'container' | 'location'): IdMapping[] {
    return Array.from(this.mappings.values()).filter(m => m.entity === entity);
  }

  /**
   * Supprimer un mapping
   */
  async removeMapping(tempId: string): Promise<boolean> {
    try {
      // Supprimer d'IndexedDB
      await this.removeMappingFromDB(tempId);
      
      // Supprimer du cache
      this.mappings.delete(tempId);
      
      console.log('[IdManager] Mapping supprimé:', tempId);
      return true;
    } catch (error) {
      console.error('[IdManager] Erreur lors de la suppression du mapping:', error);
      return false;
    }
  }

  /**
   * Nettoyer les anciens mappings
   */
  async cleanupOldMappings(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      let cleanupCount = 0;
      
      for (const [tempId, mapping] of this.mappings) {
        if (mapping.syncedAt < cutoffDate) {
          await this.removeMapping(tempId);
          cleanupCount++;
        }
      }
      
      console.log(`[IdManager] Nettoyage: ${cleanupCount} mappings anciens supprimés`);
      return cleanupCount;
    } catch (error) {
      console.error('[IdManager] Erreur lors du nettoyage:', error);
      return 0;
    }
  }

  /**
   * Obtenir les statistiques des mappings
   */
  getStats(): {
    totalMappings: number;
    mappingsByEntity: Record<string, number>;
    oldestMapping?: Date;
    newestMapping?: Date;
  } {
    const mappingsByEntity = { item: 0, category: 0, container: 0, location: 0 };
    let oldestMapping: Date | undefined;
    let newestMapping: Date | undefined;
    
    for (const mapping of this.mappings.values()) {
      mappingsByEntity[mapping.entity]++;
      
      if (!oldestMapping || mapping.createdAt < oldestMapping) {
        oldestMapping = mapping.createdAt;
      }
      
      if (!newestMapping || mapping.createdAt > newestMapping) {
        newestMapping = mapping.createdAt;
      }
    }
    
    return {
      totalMappings: this.mappings.size,
      mappingsByEntity,
      oldestMapping,
      newestMapping
    };
  }

  /**
   * Charger les mappings depuis IndexedDB
   */
  private async loadMappings(): Promise<void> {
    try {
      const mappings = await this.getAllMappingsFromDB();
      this.mappings.clear();
      
      for (const mapping of mappings) {
        this.mappings.set(mapping.tempId, mapping);
      }
      
      console.log(`[IdManager] ${mappings.length} mappings chargés depuis IndexedDB`);
    } catch (error) {
      console.error('[IdManager] Erreur lors du chargement des mappings:', error);
    }
  }

  /**
   * Mettre à jour les références dans toutes les entités locales
   */
  private async updateReferences(
    tempId: string,
    realId: number,
    entity: 'item' | 'category' | 'container' | 'location'
  ): Promise<void> {
    try {
      await localDB.transaction('rw', [localDB.items, localDB.categories, localDB.containers, localDB.locations], async () => {
        switch (entity) {
          case 'item':
            // Mettre à jour l'item lui-même
            await localDB.items.where('id').equals(tempId).modify({ id: realId });
            break;
            
          case 'category':
            // Mettre à jour la catégorie elle-même
            await localDB.categories.where('id').equals(tempId).modify({ id: realId });
            
            // Mettre à jour les items qui référencent cette catégorie
            await localDB.items.where('categoryId').equals(tempId).modify({ categoryId: realId });
            break;
            
          case 'container':
            // Mettre à jour le container lui-même
            await localDB.containers.where('id').equals(tempId).modify({ id: realId });
            
            // Mettre à jour les items qui référencent ce container
            await localDB.items.where('containerId').equals(tempId).modify({ containerId: realId });
            break;
            
          case 'location':
            // Mettre à jour la location elle-même
            await localDB.locations.where('id').equals(tempId).modify({ id: realId });
            
            // Mettre à jour les containers qui référencent cette location
            await localDB.containers.where('locationId').equals(tempId).modify({ locationId: realId });
            break;
        }
      });
      
      console.log(`[IdManager] Références mises à jour pour ${entity} ${tempId} -> ${realId}`);
    } catch (error) {
      console.error('[IdManager] Erreur lors de la mise à jour des références:', error);
    }
  }

  // Méthodes pour IndexedDB
  private async saveMappingToDB(mapping: IdMapping): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OfflineIdMappingsDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([this.ID_MAPPING_STORE], 'readwrite');
        const store = transaction.objectStore(this.ID_MAPPING_STORE);
        
        const addRequest = store.add(mapping);
        addRequest.onerror = () => reject(addRequest.error);
        addRequest.onsuccess = () => resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.ID_MAPPING_STORE)) {
          const store = db.createObjectStore(this.ID_MAPPING_STORE, { keyPath: 'id' });
          store.createIndex('tempId', 'tempId', { unique: true });
          store.createIndex('realId', 'realId');
          store.createIndex('entity', 'entity');
          store.createIndex('createdAt', 'createdAt');
        }
      };
    });
  }

  private async getAllMappingsFromDB(): Promise<IdMapping[]> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OfflineIdMappingsDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([this.ID_MAPPING_STORE], 'readonly');
        const store = transaction.objectStore(this.ID_MAPPING_STORE);
        
        const getAllRequest = store.getAll();
        getAllRequest.onerror = () => reject(getAllRequest.error);
        getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      };
    });
  }

  private async removeMappingFromDB(tempId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OfflineIdMappingsDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([this.ID_MAPPING_STORE], 'readwrite');
        const store = transaction.objectStore(this.ID_MAPPING_STORE);
        const index = store.index('tempId');
        
        const getRequest = index.get(tempId);
        getRequest.onerror = () => reject(getRequest.error);
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            const deleteRequest = store.delete(getRequest.result.id);
            deleteRequest.onerror = () => reject(deleteRequest.error);
            deleteRequest.onsuccess = () => resolve();
          } else {
            resolve(); // Mapping n'existe pas
          }
        };
      };
    });
  }
}

// Export de l'instance singleton
export const offlineIdManager = OfflineIdManager.getInstance();