import { localDB, OfflineEvent } from '../database/localDatabase';
import { SyncStatus } from '../types/offline';

export class OfflineEventQueue {
  private static instance: OfflineEventQueue;
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 10;
  private readonly PROCESSING_INTERVAL = 5000; // 5 secondes

  private constructor() {
    this.startAutoProcessing();
  }

  public static getInstance(): OfflineEventQueue {
    if (!OfflineEventQueue.instance) {
      OfflineEventQueue.instance = new OfflineEventQueue();
    }
    return OfflineEventQueue.instance;
  }

  /**
   * Ajouter un événement à la queue avec validation
   */
  async enqueue(event: OfflineEvent): Promise<string> {
    try {
      // Validation de l'événement
      this.validateEvent(event);

      // Vérifier les doublons potentiels
      const existingEvent = await this.findDuplicateEvent(event);
      if (existingEvent) {
        console.warn('[EventQueue] Événement similaire détecté, fusion...', existingEvent.id);
        return await this.mergeEvents(existingEvent, event);
      }

      // Ajouter l'événement
      await localDB.offlineEvents.add(event);
      
      console.log('[EventQueue] Événement ajouté à la queue:', event.id);
      
      // Déclencher le traitement si pas déjà en cours
      if (!this.isProcessing) {
        this.processQueue();
      }

      return event.id;
    } catch (error) {
      console.error('[EventQueue] Erreur lors de l\'ajout de l\'événement:', error);
      throw error;
    }
  }

  /**
   * Récupérer N événements les plus anciens
   */
  async dequeue(count: number = this.BATCH_SIZE): Promise<OfflineEvent[]> {
    try {
      const events = await localDB.offlineEvents
        .where('status')
        .anyOf(['pending', 'failed'])
        .limit(count)
        .sortBy('timestamp');
      
      return events;
    } catch (error) {
      console.error('[EventQueue] Erreur lors de la récupération des événements:', error);
      return [];
    }
  }

  /**
   * Voir les événements sans les retirer
   */
  async peek(count: number = 5): Promise<OfflineEvent[]> {
    try {
      return await localDB.offlineEvents
        .orderBy('timestamp')
        .limit(count)
        .toArray();
    } catch (error) {
      console.error('[EventQueue] Erreur lors du peek:', error);
      return [];
    }
  }

  /**
   * Supprimer un événement spécifique
   */
  async remove(eventId: string): Promise<boolean> {
    try {
      await localDB.offlineEvents.delete(eventId);
      console.log('[EventQueue] Événement supprimé:', eventId);
      return true;
    } catch (error) {
      console.error('[EventQueue] Erreur lors de la suppression:', error);
      return false;
    }
  }

  /**
   * Marquer comme en cours de synchronisation
   */
  async markAsSyncing(eventId: string): Promise<boolean> {
    try {
      const updated = await localDB.offlineEvents.update(eventId, {
        status: 'syncing',
        lastSyncAttempt: new Date()
      });
      
      if (updated) {
        console.log('[EventQueue] Événement marqué comme en cours de sync:', eventId);
      }
      
      return updated > 0;
    } catch (error) {
      console.error('[EventQueue] Erreur lors du marquage syncing:', error);
      return false;
    }
  }

  /**
   * Marquer comme synchronisé
   */
  async markAsSynced(eventId: string): Promise<boolean> {
    try {
      const updated = await localDB.offlineEvents.update(eventId, {
        status: 'synced',
        lastSyncAttempt: new Date()
      });
      
      if (updated) {
        console.log('[EventQueue] Événement marqué comme synchronisé:', eventId);
      }
      
      return updated > 0;
    } catch (error) {
      console.error('[EventQueue] Erreur lors du marquage synced:', error);
      return false;
    }
  }

  /**
   * Marquer comme échoué avec raison
   */
  async markAsFailed(eventId: string, errorMessage: string): Promise<boolean> {
    try {
      const event = await localDB.offlineEvents.get(eventId);
      if (!event) {
        console.warn('[EventQueue] Événement non trouvé pour marking failed:', eventId);
        return false;
      }

      const updated = await localDB.offlineEvents.update(eventId, {
        status: 'failed',
        syncAttempts: event.syncAttempts + 1,
        lastSyncAttempt: new Date(),
        errorMessage
      });
      
      if (updated) {
        console.log('[EventQueue] Événement marqué comme échoué:', eventId, errorMessage);
      }
      
      return updated > 0;
    } catch (error) {
      console.error('[EventQueue] Erreur lors du marquage failed:', error);
      return false;
    }
  }

  /**
   * Récupérer par statut
   */
  async getByStatus(status: SyncStatus): Promise<OfflineEvent[]> {
    try {
      return await localDB.offlineEvents
        .where('status')
        .equals(status)
        .sortBy('timestamp');
    } catch (error) {
      console.error('[EventQueue] Erreur lors de la récupération par statut:', error);
      return [];
    }
  }

  /**
   * Récupérer tous les échecs
   */
  async getFailedEvents(): Promise<OfflineEvent[]> {
    return this.getByStatus('failed');
  }

  /**
   * Remettre en pending un événement failed
   */
  async retry(eventId: string): Promise<boolean> {
    try {
      const updated = await localDB.offlineEvents.update(eventId, {
        status: 'pending',
        errorMessage: undefined
      });
      
      if (updated) {
        console.log('[EventQueue] Événement remis en pending pour retry:', eventId);
        
        // Déclencher le traitement
        if (!this.isProcessing) {
          this.processQueue();
        }
      }
      
      return updated > 0;
    } catch (error) {
      console.error('[EventQueue] Erreur lors du retry:', error);
      return false;
    }
  }

  /**
   * Vider la queue avec confirmation
   */
  async clear(confirmationToken?: string): Promise<boolean> {
    if (confirmationToken !== 'CLEAR_ALL_EVENTS') {
      throw new Error('Token de confirmation requis pour vider la queue');
    }

    try {
      const count = await localDB.offlineEvents.count();
      await localDB.offlineEvents.clear();
      
      console.log(`[EventQueue] Queue vidée: ${count} événements supprimés`);
      return true;
    } catch (error) {
      console.error('[EventQueue] Erreur lors du vidage:', error);
      return false;
    }
  }

  /**
   * Statistiques de la queue
   */
  async getQueueStats(): Promise<{
    total: number;
    pending: number;
    syncing: number;
    synced: number;
    failed: number;
    conflicts: number;
    oldestEvent?: Date;
    newestEvent?: Date;
  }> {
    try {
      const [
        total,
        pending,
        syncing,
        synced,
        failed,
        conflicts,
        oldestEvent,
        newestEvent
      ] = await Promise.all([
        localDB.offlineEvents.count(),
        localDB.offlineEvents.where('status').equals('pending').count(),
        localDB.offlineEvents.where('status').equals('syncing').count(),
        localDB.offlineEvents.where('status').equals('synced').count(),
        localDB.offlineEvents.where('status').equals('failed').count(),
        localDB.offlineEvents.where('status').equals('conflict').count(),
        localDB.offlineEvents.orderBy('timestamp').first(),
        localDB.offlineEvents.orderBy('timestamp').last()
      ]);

      return {
        total,
        pending,
        syncing,
        synced,
        failed,
        conflicts,
        oldestEvent: oldestEvent?.timestamp,
        newestEvent: newestEvent?.timestamp
      };
    } catch (error) {
      console.error('[EventQueue] Erreur lors de la récupération des stats:', error);
      return {
        total: 0,
        pending: 0,
        syncing: 0,
        synced: 0,
        failed: 0,
        conflicts: 0
      };
    }
  }

  /**
   * Démarrer le traitement automatique
   */
  private startAutoProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(() => {
      if (!this.isProcessing) {
        this.processQueue();
      }
    }, this.PROCESSING_INTERVAL);
  }

  /**
   * Traiter la queue (méthode simple pour maintenant)
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    
    try {
      const pendingEvents = await this.dequeue();
      
      if (pendingEvents.length === 0) {
        return;
      }

      console.log(`[EventQueue] Traitement de ${pendingEvents.length} événements...`);
      
      // Pour l'instant, on va juste logger les événements
      // La synchronisation réelle sera implémentée dans la Phase 3
      for (const event of pendingEvents) {
        console.log('[EventQueue] Événement en attente de sync:', {
          id: event.id,
          type: event.type,
          entity: event.entity,
          timestamp: event.timestamp
        });
      }
      
    } catch (error) {
      console.error('[EventQueue] Erreur lors du traitement de la queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Validation d'un événement
   */
  private validateEvent(event: OfflineEvent): void {
    if (!event.id) {
      throw new Error('ID de l\'événement requis');
    }
    
    if (!event.type || !event.entity) {
      throw new Error('Type et entité de l\'événement requis');
    }
    
    if (!event.entityId) {
      throw new Error('ID de l\'entité requis');
    }
    
    if (!event.timestamp) {
      throw new Error('Timestamp de l\'événement requis');
    }
  }

  /**
   * Détecter les événements dupliqués
   */
  private async findDuplicateEvent(newEvent: OfflineEvent): Promise<OfflineEvent | null> {
    try {
      // Chercher des événements similaires dans les 5 dernières minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const existingEvents = await localDB.offlineEvents
        .where('entityId')
        .equals(newEvent.entityId)
        .and(event => 
          event.entity === newEvent.entity &&
          event.type === newEvent.type &&
          event.timestamp > fiveMinutesAgo &&
          event.status === 'pending'
        )
        .toArray();
      
      return existingEvents.length > 0 ? existingEvents[0] : null;
    } catch (error) {
      console.error('[EventQueue] Erreur lors de la détection de doublons:', error);
      return null;
    }
  }

  /**
   * Fusionner deux événements similaires
   */
  private async mergeEvents(existing: OfflineEvent, newEvent: OfflineEvent): Promise<string> {
    try {
      // Mettre à jour l'événement existant avec les nouvelles données
      await localDB.offlineEvents.update(existing.id, {
        data: newEvent.data, // Utiliser les données les plus récentes
        timestamp: new Date(), // Mettre à jour le timestamp
        metadata: {
          ...existing.metadata,
          ...newEvent.metadata
        }
      });
      
      console.log('[EventQueue] Événements fusionnés:', existing.id);
      return existing.id;
    } catch (error) {
      console.error('[EventQueue] Erreur lors de la fusion:', error);
      throw error;
    }
  }

  /**
   * Nettoyer la queue (supprimer les événements synchronisés anciens)
   */
  async cleanup(daysToKeep: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const deletedCount = await localDB.offlineEvents
        .where('status')
        .equals('synced')
        .and(event => event.timestamp < cutoffDate)
        .delete();
      
      console.log(`[EventQueue] Nettoyage: ${deletedCount} événements anciens supprimés`);
      return deletedCount;
    } catch (error) {
      console.error('[EventQueue] Erreur lors du nettoyage:', error);
      return 0;
    }
  }

  /**
   * Arrêter le traitement automatique
   */
  destroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
  }
}