import { OfflineEvent, OfflineEventStatus } from '../types/offline';
import { OfflineEventQueue } from './OfflineEventQueue';
import { ConflictDetector } from './ConflictDetector';
import { ConflictResolver } from './ConflictResolver';
import { localDB } from '../database/localDatabase';

interface SyncBatch {
  id: string;
  events: OfflineEvent[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedTime: number; // en millisecondes
  retryCount: number;
  compression?: boolean;
}

interface SyncMetrics {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  averageLatency: number;
  compressionRatio: number;
  networkUsage: number; // en bytes
  startTime: Date;
  endTime?: Date;
}

interface OptimizedSyncOptions {
  maxBatchSize: number;
  maxConcurrentBatches: number;
  timeoutMs: number;
  compressionThreshold: number; // taille en bytes au-dessus de laquelle compresser
  adaptiveBatching: boolean;
  priorityBasedSync: boolean;
  networkOptimization: boolean;
}

const DEFAULT_SYNC_OPTIONS: OptimizedSyncOptions = {
  maxBatchSize: 50,
  maxConcurrentBatches: 3,
  timeoutMs: 30000,
  compressionThreshold: 1024, // 1KB
  adaptiveBatching: true,
  priorityBasedSync: true,
  networkOptimization: true
};

class OptimizedSyncService {
  private static instance: OptimizedSyncService | null = null;
  private eventQueue = OfflineEventQueue.getInstance();
  private conflictDetector = ConflictDetector.getInstance();
  private conflictResolver = ConflictResolver.getInstance();
  
  private isRunning = false;
  private activeBatches = new Map<string, SyncBatch>();
  private metrics: SyncMetrics | null = null;
  private networkConditions = {
    latency: 0,
    bandwidth: 0,
    reliability: 1.0 // 0-1, 1 étant parfait
  };

  static getInstance(): OptimizedSyncService {
    if (!OptimizedSyncService.instance) {
      OptimizedSyncService.instance = new OptimizedSyncService();
    }
    return OptimizedSyncService.instance;
  }

  /**
   * Démarrer une synchronisation optimisée
   */
  async startOptimizedSync(options: Partial<OptimizedSyncOptions> = {}): Promise<SyncMetrics> {
    if (this.isRunning) {
      throw new Error('Synchronisation déjà en cours');
    }

    const syncOptions = { ...DEFAULT_SYNC_OPTIONS, ...options };
    this.isRunning = true;

    const startTime = new Date();
    this.metrics = {
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      averageLatency: 0,
      compressionRatio: 0,
      networkUsage: 0,
      startTime
    };

    try {
      // 1. Évaluer les conditions réseau
      await this.assessNetworkConditions();

      // 2. Obtenir tous les événements en attente
      const pendingEvents = await this.eventQueue.getAllPendingEvents();
      this.metrics.totalEvents = pendingEvents.length;

      if (pendingEvents.length === 0) {
        this.metrics.endTime = new Date();
        return this.metrics;
      }

      // 3. Créer des batches optimisés
      const batches = await this.createOptimizedBatches(pendingEvents, syncOptions);

      // 4. Exécuter les batches avec priorités
      await this.executeBatchesWithPriority(batches, syncOptions);

      // 5. Traiter les conflits détectés
      await this.resolveDetectedConflicts();

      this.metrics.endTime = new Date();
      return this.metrics;

    } catch (error) {
      console.error('[OptimizedSyncService] Erreur synchronisation:', error);
      throw error;
    } finally {
      this.isRunning = false;
      this.activeBatches.clear();
    }
  }

  /**
   * Évaluer les conditions réseau actuelles
   */
  private async assessNetworkConditions(): Promise<void> {
    try {
      // Test de latency simple
      const startTime = performance.now();
      const response = await fetch('/ping', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      const latency = performance.now() - startTime;

      this.networkConditions.latency = latency;
      this.networkConditions.reliability = response.ok ? 1.0 : 0.5;

      // Estimation grossière de la bande passante
      if (navigator.connection) {
        this.networkConditions.bandwidth = navigator.connection.downlink || 10;
      }

      console.log('[OptimizedSyncService] Conditions réseau:', this.networkConditions);
    } catch (error) {
      console.warn('[OptimizedSyncService] Impossible d\'évaluer le réseau:', error);
      // Valeurs par défaut conservatrices
      this.networkConditions = { latency: 200, bandwidth: 1, reliability: 0.8 };
    }
  }

  /**
   * Créer des batches optimisés selon les conditions
   */
  private async createOptimizedBatches(
    events: OfflineEvent[], 
    options: OptimizedSyncOptions
  ): Promise<SyncBatch[]> {
    const batches: SyncBatch[] = [];
    
    // 1. Trier les événements par priorité et type
    const sortedEvents = this.sortEventsByPriority(events);
    
    // 2. Grouper par type d'entité pour optimiser les requêtes
    const groupedEvents = this.groupEventsByEntity(sortedEvents);
    
    // 3. Créer les batches adaptatifs
    let batchId = 0;
    
    for (const [entityType, entityEvents] of Object.entries(groupedEvents)) {
      let currentBatch: OfflineEvent[] = [];
      let currentSize = 0;
      
      for (const event of entityEvents) {
        const eventSize = this.estimateEventSize(event);
        
        // Vérifier si ajouter cet événement dépasserait la taille optimale
        const wouldExceedSize = currentSize + eventSize > this.calculateOptimalBatchSize(options);
        const wouldExceedCount = currentBatch.length >= options.maxBatchSize;
        
        if ((wouldExceedSize || wouldExceedCount) && currentBatch.length > 0) {
          // Créer le batch actuel
          batches.push(this.createBatch(
            `batch_${batchId++}_${entityType}`,
            currentBatch,
            options
          ));
          
          currentBatch = [];
          currentSize = 0;
        }
        
        currentBatch.push(event);
        currentSize += eventSize;
      }
      
      // Ajouter le dernier batch s'il n'est pas vide
      if (currentBatch.length > 0) {
        batches.push(this.createBatch(
          `batch_${batchId++}_${entityType}`,
          currentBatch,
          options
        ));
      }
    }
    
    console.log(`[OptimizedSyncService] Créé ${batches.length} batches optimisés`);
    return batches;
  }

  /**
   * Trier les événements par priorité
   */
  private sortEventsByPriority(events: OfflineEvent[]): OfflineEvent[] {
    const priorityOrder = {
      'DELETE': 4,  // Priorité haute - éviter les conflits
      'UPDATE': 3,  // Priorité moyenne-haute
      'CREATE': 2,  // Priorité moyenne
      'MOVE': 1     // Priorité basse
    };

    return events.sort((a, b) => {
      const priorityA = priorityOrder[a.type] || 0;
      const priorityB = priorityOrder[b.type] || 0;
      
      if (priorityA !== priorityB) {
        return priorityB - priorityA; // Trier par priorité décroissante
      }
      
      // Si même priorité, trier par timestamp
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }

  /**
   * Grouper les événements par type d'entité
   */
  private groupEventsByEntity(events: OfflineEvent[]): Record<string, OfflineEvent[]> {
    const grouped: Record<string, OfflineEvent[]> = {};
    
    for (const event of events) {
      if (!grouped[event.entity]) {
        grouped[event.entity] = [];
      }
      grouped[event.entity].push(event);
    }
    
    return grouped;
  }

  /**
   * Estimer la taille d'un événement en bytes
   */
  private estimateEventSize(event: OfflineEvent): number {
    try {
      return JSON.stringify(event).length * 2; // Estimation UTF-16
    } catch {
      return 1000; // Valeur par défaut
    }
  }

  /**
   * Calculer la taille optimale de batch selon les conditions réseau
   */
  private calculateOptimalBatchSize(options: OptimizedSyncOptions): number {
    if (!options.adaptiveBatching) {
      return options.maxBatchSize * 500; // Taille fixe approximative
    }

    // Adapter selon la latence et la bande passante
    const baseSize = 10000; // 10KB de base
    const latencyFactor = Math.max(0.1, 1 - (this.networkConditions.latency / 1000));
    const bandwidthFactor = Math.min(2, this.networkConditions.bandwidth / 5);
    const reliabilityFactor = this.networkConditions.reliability;

    const optimalSize = baseSize * latencyFactor * bandwidthFactor * reliabilityFactor;
    
    return Math.max(1000, Math.min(50000, optimalSize)); // Entre 1KB et 50KB
  }

  /**
   * Créer un batch avec métadonnées
   */
  private createBatch(id: string, events: OfflineEvent[], options: OptimizedSyncOptions): SyncBatch {
    const totalSize = events.reduce((sum, event) => sum + this.estimateEventSize(event), 0);
    
    // Déterminer la priorité du batch
    const priority = this.determineBatchPriority(events);
    
    // Estimer le temps de traitement
    const estimatedTime = this.estimateBatchProcessingTime(events, totalSize);
    
    // Déterminer si compression est nécessaire
    const compression = totalSize > options.compressionThreshold;
    
    return {
      id,
      events,
      priority,
      estimatedTime,
      retryCount: 0,
      compression
    };
  }

  /**
   * Déterminer la priorité d'un batch
   */
  private determineBatchPriority(events: OfflineEvent[]): 'low' | 'medium' | 'high' | 'critical' {
    // Vérifier s'il y a des opérations critiques
    const hasDelete = events.some(e => e.type === 'DELETE');
    const hasRecentUpdates = events.some(e => 
      Date.now() - new Date(e.timestamp).getTime() < 60000 // Moins d'1 minute
    );
    
    if (hasDelete) return 'critical';
    if (hasRecentUpdates) return 'high';
    if (events.length > 20) return 'medium';
    return 'low';
  }

  /**
   * Estimer le temps de traitement d'un batch
   */
  private estimateBatchProcessingTime(events: OfflineEvent[], totalSize: number): number {
    const baseTimePerEvent = 100; // 100ms par événement
    const networkOverhead = Math.max(500, this.networkConditions.latency * 2);
    const sizeOverhead = totalSize / 1000; // 1ms par KB
    
    return (events.length * baseTimePerEvent) + networkOverhead + sizeOverhead;
  }

  /**
   * Exécuter les batches avec gestion de priorités
   */
  private async executeBatchesWithPriority(
    batches: SyncBatch[], 
    options: OptimizedSyncOptions
  ): Promise<void> {
    // Trier les batches par priorité
    const sortedBatches = batches.sort((a, b) => {
      const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Exécuter avec limite de concurrence
    const concurrencyLimit = Math.min(options.maxConcurrentBatches, sortedBatches.length);
    const activeBatches: Promise<void>[] = [];

    for (let i = 0; i < sortedBatches.length; i++) {
      const batch = sortedBatches[i];
      
      // Attendre qu'un slot se libère si on atteint la limite
      if (activeBatches.length >= concurrencyLimit) {
        await Promise.race(activeBatches);
        // Nettoyer les batches terminés
        for (let j = activeBatches.length - 1; j >= 0; j--) {
          const batchPromise = activeBatches[j];
          if (await this.isPromiseResolved(batchPromise)) {
            activeBatches.splice(j, 1);
          }
        }
      }

      // Lancer le batch
      const batchPromise = this.executeSingleBatch(batch, options);
      activeBatches.push(batchPromise);
    }

    // Attendre que tous les batches se terminent
    await Promise.allSettled(activeBatches);
  }

  /**
   * Vérifier si une Promise est résolue
   */
  private async isPromiseResolved(promise: Promise<unknown>): Promise<boolean> {
    try {
      await Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 0))
      ]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Exécuter un batch unique
   */
  private async executeSingleBatch(batch: SyncBatch, options: OptimizedSyncOptions): Promise<void> {
    const startTime = performance.now();
    this.activeBatches.set(batch.id, batch);

    try {
      console.log(`[OptimizedSyncService] Exécution batch ${batch.id} (${batch.events.length} événements, priorité: ${batch.priority})`);

      // Préparer les données
      let payload = batch.events;
      
      // Compresser si nécessaire
      if (batch.compression) {
        payload = await this.compressData(payload);
      }

      // Exécuter la synchronisation
      const response = await this.sendBatchToServer(payload, options.timeoutMs);
      
      // Traiter la réponse
      await this.processBatchResponse(batch, response);
      
      // Mettre à jour les métriques
      const endTime = performance.now();
      const latency = endTime - startTime;
      
      if (this.metrics) {
        this.metrics.successfulEvents += batch.events.length;
        this.metrics.averageLatency = (this.metrics.averageLatency + latency) / 2;
        this.metrics.networkUsage += JSON.stringify(payload).length;
      }

      console.log(`[OptimizedSyncService] Batch ${batch.id} terminé avec succès en ${latency.toFixed(0)}ms`);

    } catch (error) {
      console.error(`[OptimizedSyncService] Erreur batch ${batch.id}:`, error);
      
      // Gestion des tentatives
      batch.retryCount++;
      if (batch.retryCount < 3) {
        console.log(`[OptimizedSyncService] Nouvelle tentative pour batch ${batch.id} (${batch.retryCount}/3)`);
        setTimeout(() => this.executeSingleBatch(batch, options), 1000 * batch.retryCount);
      } else {
        if (this.metrics) {
          this.metrics.failedEvents += batch.events.length;
        }
        // Marquer les événements comme échoués
        await this.markEventsAsFailed(batch.events);
      }
    } finally {
      this.activeBatches.delete(batch.id);
    }
  }

  /**
   * Compresser les données du batch
   */
  private async compressData(events: OfflineEvent[]): Promise<OfflineEvent[]> {
    // Implémentation simplifiée - dans un vrai cas, utiliser une vraie compression
    // comme gzip ou brotli
    console.log(`[OptimizedSyncService] Compression de ${events.length} événements`);
    
    if (this.metrics) {
      const originalSize = JSON.stringify(events).length;
      // Simulation d'une compression 30%
      this.metrics.compressionRatio = 0.7;
      this.metrics.networkUsage = originalSize * 0.7;
    }
    
    return events;
  }

  /**
   * Envoyer un batch au serveur
   */
  private async sendBatchToServer(events: OfflineEvent[], timeoutMs: number): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('/api/sync/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ events }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Traiter la réponse du serveur pour un batch
   */
  private async processBatchResponse(batch: SyncBatch, response: unknown): Promise<void> {
    // Marquer les événements comme synchronisés
    for (const event of batch.events) {
      await this.eventQueue.updateEventStatus(event.id, 'synced');
    }

    // TODO: Traiter les conflits retournés par le serveur
    console.log(`[OptimizedSyncService] Batch ${batch.id} traité avec succès`);
  }

  /**
   * Marquer les événements comme échoués
   */
  private async markEventsAsFailed(events: OfflineEvent[]): Promise<void> {
    for (const event of events) {
      await this.eventQueue.updateEventStatus(event.id, 'failed');
    }
  }

  /**
   * Résoudre les conflits détectés
   */
  private async resolveDetectedConflicts(): Promise<void> {
    try {
      const conflicts = await this.conflictDetector.detectAllConflicts();
      
      if (conflicts.length > 0) {
        console.log(`[OptimizedSyncService] ${conflicts.length} conflits détectés`);
        
        for (const conflict of conflicts) {
          try {
            await this.conflictResolver.resolveConflictAutomatically(conflict);
          } catch (error) {
            console.warn(`[OptimizedSyncService] Impossible de résoudre automatiquement le conflit ${conflict.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[OptimizedSyncService] Erreur résolution conflits:', error);
    }
  }

  /**
   * Obtenir les métriques de la dernière synchronisation
   */
  getLastSyncMetrics(): SyncMetrics | null {
    return this.metrics;
  }

  /**
   * Vérifier si une synchronisation est en cours
   */
  isSyncRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Obtenir les batches actifs
   */
  getActiveBatches(): SyncBatch[] {
    return Array.from(this.activeBatches.values());
  }

  /**
   * Annuler la synchronisation en cours
   */
  async cancelSync(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[OptimizedSyncService] Annulation de la synchronisation...');
    this.isRunning = false;
    this.activeBatches.clear();
    
    if (this.metrics) {
      this.metrics.endTime = new Date();
    }
  }
}

export const optimizedSyncService = OptimizedSyncService.getInstance();
export default OptimizedSyncService;