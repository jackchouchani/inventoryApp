import { localDB, OfflineEvent } from '../database/localDatabase';
import { OfflineEventQueue } from './OfflineEventQueue';
import { offlineIdManager } from '../utils/offlineIdManager';
import { supabase } from '../config/supabase';
import { SyncOptions, SyncResult, SyncError, SyncState } from '../types/offline';
import { ConflictDetector } from './ConflictDetector';
import { ConflictResolver } from './ConflictResolver';

export class SyncService {
  private static instance: SyncService;
  private eventQueue: OfflineEventQueue;
  private conflictDetector: ConflictDetector;
  private conflictResolver: ConflictResolver;
  private syncInProgress = false;
  private syncState: SyncState = {
    isSync: false,
    progress: 0,
    currentOperation: '',
    remainingEvents: 0,
    errors: [],
    startTime: null,
    estimatedTimeRemaining: 0
  };
  private syncListeners: ((state: SyncState) => void)[] = [];

  private constructor() {
    this.eventQueue = OfflineEventQueue.getInstance();
    this.conflictDetector = ConflictDetector.getInstance();
    this.conflictResolver = ConflictResolver.getInstance();
  }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  /**
   * Démarrer une synchronisation complète
   */
  async startSync(options: SyncOptions = {}): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Synchronisation déjà en cours');
    }

    this.syncInProgress = true;
    const startTime = new Date();
    
    this.updateSyncState({
      isSync: true,
      progress: 0,
      currentOperation: 'Initialisation...',
      startTime,
      errors: []
    });

    try {
      console.log('[SyncService] Début de la synchronisation');
      
      // 1. Vérifier la connectivité
      await this.checkConnectivity();
      
      // 2. Pull des changements serveur
      this.updateSyncState({ 
        progress: 10, 
        currentOperation: 'Récupération des changements serveur...' 
      });
      await this.pullServerChanges();
      
      // 3. Détecter les conflits
      this.updateSyncState({ 
        progress: 30, 
        currentOperation: 'Détection des conflits...' 
      });
      const conflicts = await this.detectConflicts();
      
      // 4. Résoudre les conflits automatiquement
      if (conflicts.length > 0) {
        this.updateSyncState({ 
          progress: 50, 
          currentOperation: `Résolution de ${conflicts.length} conflits...` 
        });
        await this.resolveConflictsAutomatically(conflicts);
      }
      
      // 5. Push des changements locaux
      this.updateSyncState({ 
        progress: 70, 
        currentOperation: 'Envoi des changements locaux...' 
      });
      const pushResult = await this.pushLocalChanges(options);
      
      // 6. Finalisation
      this.updateSyncState({ 
        progress: 90, 
        currentOperation: 'Finalisation...' 
      });
      await this.finalizeSynchronization();
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const result: SyncResult = {
        success: true,
        syncedEvents: pushResult.syncedEvents,
        failedEvents: pushResult.failedEvents,
        conflictsDetected: conflicts.length,
        conflictsResolved: conflicts.filter(c => c.resolution).length,
        errors: pushResult.errors,
        duration
      };
      
      this.updateSyncState({ 
        progress: 100, 
        currentOperation: 'Synchronisation terminée',
        isSync: false
      });
      
      console.log('[SyncService] Synchronisation terminée avec succès:', result);
      return result;
      
    } catch (error) {
      console.error('[SyncService] Erreur lors de la synchronisation:', error);
      
      const syncError: SyncError = {
        eventId: 'sync',
        type: 'unknown',
        message: (error as Error).message || 'Erreur inconnue',
        details: error,
        retryable: true
      };
      
      this.updateSyncState({ 
        isSync: false,
        errors: [syncError]
      });
      
      const result: SyncResult = {
        success: false,
        syncedEvents: 0,
        failedEvents: 0,
        conflictsDetected: 0,
        conflictsResolved: 0,
        errors: [syncError],
        duration: Date.now() - startTime.getTime()
      };
      
      return result;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Synchroniser un batch d'événements spécifiques
   */
  async syncBatch(events: OfflineEvent[], options: SyncOptions = {}): Promise<SyncResult> {
    const { batchSize = 10, maxRetries = 3, timeoutMs = 30000 } = options;
    const startTime = Date.now();
    let syncedEvents = 0;
    let failedEvents = 0;
    const errors: SyncError[] = [];

    console.log(`[SyncService] Synchronisation d'un batch de ${events.length} événements`);

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      
      this.updateSyncState({
        progress: Math.floor((i / events.length) * 100),
        currentOperation: `Traitement du batch ${Math.floor(i / batchSize) + 1}...`,
        remainingEvents: events.length - i
      });

      for (const event of batch) {
        try {
          // Marquer comme en cours de synchronisation
          await this.eventQueue.markAsSyncing(event.id);
          
          // Synchroniser l'événement
          const success = await this.syncSingleEvent(event, { timeoutMs, maxRetries });
          
          if (success) {
            await this.eventQueue.markAsSynced(event.id);
            syncedEvents++;
          } else {
            await this.eventQueue.markAsFailed(event.id, 'Échec de synchronisation');
            failedEvents++;
          }
          
        } catch (error) {
          console.error(`[SyncService] Erreur lors de la sync de l'événement ${event.id}:`, error);
          
          const syncError: SyncError = {
            eventId: event.id,
            type: 'unknown',
            message: (error as Error).message || 'Erreur de synchronisation',
            details: error,
            retryable: true
          };
          
          errors.push(syncError);
          await this.eventQueue.markAsFailed(event.id, syncError.message);
          failedEvents++;
        }
      }
    }

    const duration = Date.now() - startTime;
    
    return {
      success: failedEvents === 0,
      syncedEvents,
      failedEvents,
      conflictsDetected: 0,
      conflictsResolved: 0,
      errors,
      duration
    };
  }

  /**
   * Récupérer les changements serveur depuis la dernière sync
   */
  async pullServerChanges(): Promise<void> {
    console.log('[SyncService] Récupération des changements serveur...');
    
    try {
      // Récupérer les métadonnées de sync pour connaître la dernière sync
      const syncMetadata = await localDB.syncMetadata.toArray();
      
      // Pour chaque entité, récupérer les changements depuis lastSyncTimestamp
      for (const entityType of ['item', 'category', 'container', 'location'] as const) {
        const metadata = syncMetadata.find(m => m.entity === entityType);
        const lastSync = metadata?.lastSyncTimestamp || new Date(0);
        
        await this.pullEntityChanges(entityType, lastSync);
      }
      
    } catch (error) {
      console.error('[SyncService] Erreur lors du pull des changements serveur:', error);
      throw error;
    }
  }

  /**
   * Envoyer les changements locaux vers le serveur
   */
  async pushLocalChanges(options: SyncOptions = {}): Promise<{
    syncedEvents: number;
    failedEvents: number;
    errors: SyncError[];
  }> {
    console.log('[SyncService] Envoi des changements locaux...');
    
    // Récupérer tous les événements en attente
    const pendingEvents = await this.eventQueue.getByStatus('pending');
    
    if (pendingEvents.length === 0) {
      console.log('[SyncService] Aucun changement local à synchroniser');
      return { syncedEvents: 0, failedEvents: 0, errors: [] };
    }
    
    // Trier les événements par timestamp pour respecter l'ordre
    const sortedEvents = pendingEvents.sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );
    
    return await this.syncBatch(sortedEvents, options);
  }

  /**
   * Fusionner les bases de données (appelé après pull et avant push)
   */
  async mergeDatabases(): Promise<void> {
    console.log('[SyncService] Fusion des bases de données...');
    
    // Cette méthode sera implémentée pour fusionner intelligemment
    // les données serveur avec les données locales
    // TODO: Implémenter la logique de fusion
  }

  /**
   * Vérifier la connectivité
   */
  private async checkConnectivity(): Promise<void> {
    try {
      const { error } = await supabase.from('items').select('id').limit(1);
      
      if (error) {
        throw new Error(`Problème de connectivité: ${error.message}`);
      }
      
      console.log('[SyncService] Connectivité vérifiée');
    } catch (error) {
      console.error('[SyncService] Erreur de connectivité:', error);
      throw new Error('Impossible de se connecter au serveur');
    }
  }

  /**
   * Récupérer les changements pour une entité spécifique
   */
  private async pullEntityChanges(
    entityType: 'item' | 'category' | 'container' | 'location',
    lastSync: Date
  ): Promise<void> {
    console.log(`[SyncService] Pull ${entityType} depuis ${lastSync.toISOString()}`);
    
    try {
      const tableName = this.getTableName(entityType);
      
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .gte('updated_at', lastSync.toISOString())
        .order('updated_at', { ascending: true });
      
      if (error) {
        throw new Error(`Erreur lors du pull ${entityType}: ${error.message}`);
      }
      
      if (data && data.length > 0) {
        console.log(`[SyncService] ${data.length} ${entityType}(s) récupéré(s) du serveur`);
        
        // Mettre à jour la base locale avec les données serveur
        await this.updateLocalDatabase(entityType, data);
        
        // Mettre à jour les métadonnées de sync
        await this.updateSyncMetadata(entityType, new Date());
      }
      
    } catch (error) {
      console.error(`[SyncService] Erreur lors du pull ${entityType}:`, error);
      throw error;
    }
  }

  /**
   * Synchroniser un événement unique
   */
  private async syncSingleEvent(
    event: OfflineEvent, 
    options: { timeoutMs?: number; maxRetries?: number } = {}
  ): Promise<boolean> {
    const { timeoutMs = 10000 } = options;
    
    console.log(`[SyncService] Synchronisation de l'événement ${event.id}:`, {
      type: event.type,
      entity: event.entity,
      entityId: event.entityId
    });
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      let success = false;
      
      try {
        switch (event.type) {
          case 'CREATE':
            success = await this.syncCreateEvent(event, controller.signal);
            break;
          case 'UPDATE':
            success = await this.syncUpdateEvent(event, controller.signal);
            break;
          case 'DELETE':
            success = await this.syncDeleteEvent(event, controller.signal);
            break;
          case 'MOVE':
            success = await this.syncMoveEvent(event, controller.signal);
            break;
          case 'ASSIGN':
            success = await this.syncAssignEvent(event, controller.signal);
            break;
          default:
            console.warn(`[SyncService] Type d'événement non supporté: ${event.type}`);
            return false;
        }
      } finally {
        clearTimeout(timeoutId);
      }
      
      return success;
      
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.error(`[SyncService] Timeout lors de la sync de l'événement ${event.id}`);
      } else {
        console.error(`[SyncService] Erreur lors de la sync de l'événement ${event.id}:`, error);
      }
      return false;
    }
  }

  /**
   * Synchroniser un événement de création
   */
  private async syncCreateEvent(event: OfflineEvent, _signal: AbortSignal): Promise<boolean> {
    const tableName = this.getTableName(event.entity);
    const data = this.prepareDataForServer(event.data, event.entity);
    
    try {
      const { data: result, error } = await supabase
        .from(tableName)
        .insert(data)
        .select()
        .single();
      
      if (error) {
        console.error(`[SyncService] Erreur CREATE ${event.entity}:`, error);
        return false;
      }
      
      // Créer le mapping ID temporaire -> ID réel
      if (offlineIdManager.isOfflineId(event.entityId)) {
        await offlineIdManager.createMapping(
          event.entityId as string,
          result.id,
          event.entity
        );
      }
      
      // Mettre à jour la base locale avec l'entité synchronisée
      await this.updateLocalEntity(event.entity, result);
      
      console.log(`[SyncService] CREATE ${event.entity} synchronisé:`, result.id);
      return true;
      
    } catch (error) {
      console.error(`[SyncService] Erreur lors du CREATE ${event.entity}:`, error);
      return false;
    }
  }

  /**
   * Synchroniser un événement de mise à jour
   */
  private async syncUpdateEvent(event: OfflineEvent, _signal: AbortSignal): Promise<boolean> {
    const tableName = this.getTableName(event.entity);
    const entityId = offlineIdManager.resolveId(event.entityId);
    const data = this.prepareDataForServer(event.data, event.entity);
    
    try {
      const { data: result, error } = await supabase
        .from(tableName)
        .update(data)
        .eq('id', entityId)
        .select()
        .single();
      
      if (error) {
        console.error(`[SyncService] Erreur UPDATE ${event.entity}:`, error);
        return false;
      }
      
      // Mettre à jour la base locale
      await this.updateLocalEntity(event.entity, result);
      
      console.log(`[SyncService] UPDATE ${event.entity} synchronisé:`, result.id);
      return true;
      
    } catch (error) {
      console.error(`[SyncService] Erreur lors de l'UPDATE ${event.entity}:`, error);
      return false;
    }
  }

  /**
   * Synchroniser un événement de suppression
   */
  private async syncDeleteEvent(event: OfflineEvent, signal: AbortSignal): Promise<boolean> {
    const tableName = this.getTableName(event.entity);
    const entityId = offlineIdManager.resolveId(event.entityId);
    
    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', entityId)
        .abortSignal(signal);
      
      if (error) {
        console.error(`[SyncService] Erreur DELETE ${event.entity}:`, error);
        return false;
      }
      
      // Supprimer de la base locale
      await this.removeLocalEntity(event.entity, entityId);
      
      console.log(`[SyncService] DELETE ${event.entity} synchronisé:`, entityId);
      return true;
      
    } catch (error) {
      console.error(`[SyncService] Erreur lors du DELETE ${event.entity}:`, error);
      return false;
    }
  }

  /**
   * Synchroniser un événement de déplacement
   */
  private async syncMoveEvent(event: OfflineEvent, signal: AbortSignal): Promise<boolean> {
    // Les événements MOVE sont traités comme des UPDATE
    return await this.syncUpdateEvent(event, signal);
  }

  /**
   * Synchroniser un événement d'assignation
   */
  private async syncAssignEvent(event: OfflineEvent, signal: AbortSignal): Promise<boolean> {
    // Les événements ASSIGN sont traités comme des UPDATE
    return await this.syncUpdateEvent(event, signal);
  }

  // Méthodes utilitaires privées
  private getTableName(entity: 'item' | 'category' | 'container' | 'location'): string {
    const tableMap = {
      item: 'items',
      category: 'categories',
      container: 'containers',
      location: 'locations'
    };
    return tableMap[entity];
  }

  private prepareDataForServer(data: any, _entity: 'item' | 'category' | 'container' | 'location'): any {
    // Convertir les données locales au format serveur (snake_case)
    // et résoudre les IDs temporaires
    const serverData = { ...data };
    
    // Résoudre les IDs de référence
    if (serverData.containerId) {
      serverData.container_id = offlineIdManager.resolveId(serverData.containerId);
      delete serverData.containerId;
    }
    
    if (serverData.categoryId) {
      serverData.category_id = offlineIdManager.resolveId(serverData.categoryId);
      delete serverData.categoryId;
    }
    
    if (serverData.locationId) {
      serverData.location_id = offlineIdManager.resolveId(serverData.locationId);
      delete serverData.locationId;
    }
    
    // Convertir d'autres champs
    if (serverData.purchasePrice) {
      serverData.purchase_price = serverData.purchasePrice;
      delete serverData.purchasePrice;
    }
    
    if (serverData.sellingPrice) {
      serverData.selling_price = serverData.sellingPrice;
      delete serverData.sellingPrice;
    }
    
    if (serverData.qrCode) {
      serverData.qr_code = serverData.qrCode;
      delete serverData.qrCode;
    }
    
    return serverData;
  }

  private async updateLocalDatabase(
    entityType: 'item' | 'category' | 'container' | 'location',
    serverData: any[]
  ): Promise<void> {
    // Convertir les données serveur au format local et les insérer dans IndexedDB
    const localData = serverData.map(item => this.convertServerToLocal(item, entityType));
    
    switch (entityType) {
      case 'item':
        await localDB.items.bulkPut(localData);
        break;
      case 'category':
        await localDB.categories.bulkPut(localData);
        break;
      case 'container':
        await localDB.containers.bulkPut(localData);
        break;
      case 'location':
        await localDB.locations.bulkPut(localData);
        break;
    }
  }

  private convertServerToLocal(serverData: any, _entityType: 'item' | 'category' | 'container' | 'location'): any {
    // Convertir snake_case vers camelCase
    const localData = { ...serverData };
    
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
    
    // Ajouter les métadonnées de sync
    localData.isOffline = false;
    localData.lastSyncedAt = new Date();
    localData.syncStatus = 'synced';
    
    return localData;
  }

  private async updateLocalEntity(
    entity: 'item' | 'category' | 'container' | 'location',
    serverData: any
  ): Promise<void> {
    const localData = this.convertServerToLocal(serverData, entity);
    
    switch (entity) {
      case 'item':
        await localDB.items.put(localData);
        break;
      case 'category':
        await localDB.categories.put(localData);
        break;
      case 'container':
        await localDB.containers.put(localData);
        break;
      case 'location':
        await localDB.locations.put(localData);
        break;
    }
  }

  private async removeLocalEntity(
    entity: 'item' | 'category' | 'container' | 'location',
    entityId: string | number
  ): Promise<void> {
    switch (entity) {
      case 'item':
        await localDB.items.delete(entityId);
        break;
      case 'category':
        await localDB.categories.delete(entityId);
        break;
      case 'container':
        await localDB.containers.delete(entityId);
        break;
      case 'location':
        await localDB.locations.delete(entityId);
        break;
    }
  }

  private async updateSyncMetadata(
    entity: 'item' | 'category' | 'container' | 'location',
    timestamp: Date
  ): Promise<void> {
    await localDB.syncMetadata.put({
      id: entity,
      entity,
      lastSyncTimestamp: timestamp,
      totalRecords: await this.getEntityCount(entity),
      pendingEvents: await this.getEntityPendingEvents(entity),
      conflictEvents: await this.getEntityConflictEvents(entity)
    });
  }

  private async getEntityCount(entity: 'item' | 'category' | 'container' | 'location'): Promise<number> {
    switch (entity) {
      case 'item':
        return await localDB.items.count();
      case 'category':
        return await localDB.categories.count();
      case 'container':
        return await localDB.containers.count();
      case 'location':
        return await localDB.locations.count();
    }
  }

  private async getEntityPendingEvents(entity: 'item' | 'category' | 'container' | 'location'): Promise<number> {
    return await localDB.offlineEvents
      .where('entity')
      .equals(entity)
      .and(event => event.status === 'pending')
      .count();
  }

  private async getEntityConflictEvents(entity: 'item' | 'category' | 'container' | 'location'): Promise<number> {
    return await localDB.offlineEvents
      .where('entity')
      .equals(entity)
      .and(event => event.status === 'conflict')
      .count();
  }

  private updateSyncState(updates: Partial<SyncState>): void {
    this.syncState = { ...this.syncState, ...updates };
    this.notifySyncListeners();
  }

  private notifySyncListeners(): void {
    this.syncListeners.forEach(listener => {
      try {
        listener(this.syncState);
      } catch (error) {
        console.error('[SyncService] Erreur dans un listener de sync:', error);
      }
    });
  }

  // Méthodes publiques pour les listeners
  public addSyncListener(listener: (state: SyncState) => void): () => void {
    this.syncListeners.push(listener);
    
    // Retourner une fonction de cleanup
    return () => {
      const index = this.syncListeners.indexOf(listener);
      if (index > -1) {
        this.syncListeners.splice(index, 1);
      }
    };
  }

  public getSyncState(): SyncState {
    return { ...this.syncState };
  }

  // Détection et résolution des conflits
  private async detectConflicts(): Promise<any[]> {
    return await this.conflictDetector.detectAllConflicts();
  }

  private async resolveConflictsAutomatically(_conflicts: any[]): Promise<void> {
    await this.conflictResolver.resolveAllConflictsAutomatically();
  }

  private async finalizeSynchronization(): Promise<void> {
    // Nettoyer les événements synchronisés anciens
    await this.eventQueue.cleanup();
    
    // Nettoyer les mappings d'IDs anciens
    await offlineIdManager.cleanupOldMappings();
    
    console.log('[SyncService] Finalisation de la synchronisation terminée');
  }
}

// Export de l'instance singleton
export const syncService = SyncService.getInstance();