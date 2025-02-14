import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Item } from '../types/item';
import { Container } from '../types/container';
import { Category } from '../types/category';
import { supabase } from '../config/supabase';
import { deflate, inflate } from 'pako';

// Clés pour le stockage local
const STORAGE_KEYS = {
  PENDING_CHANGES: 'pendingChanges',
  OFFLINE_ITEMS: 'offlineItems',
  OFFLINE_CONTAINERS: 'offlineContainers',
  OFFLINE_CATEGORIES: 'offlineCategories',
  LAST_SYNC: 'lastSync',
  CONFLICT_RESOLUTION: 'conflictResolution',
} as const;

interface PendingChange {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: 'items' | 'containers' | 'categories';
  data: any;
  timestamp: number;
  version?: number;
}

interface ConflictResolution {
  entityId: number;
  table: string;
  resolution: 'local' | 'remote';
  timestamp: number;
}

interface MutationQueueItem {
    id: string;
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    table: string;
    payload: any;
    retries: number;
    timestamp: number;
}

const QUEUE_STORAGE_KEY = 'mutationQueue';
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 seconde

interface MutationError {
  code: string;
  message: string;
  retryable: boolean;
}

// Compression des données
const compressData = (data: any): string => {
  const jsonString = JSON.stringify(data);
  const uint8Array = new TextEncoder().encode(jsonString);
  const compressed = deflate(uint8Array);
  const compressedArray = Array.from(compressed);
  return btoa(String.fromCharCode(...compressedArray));
};

// Décompression des données
const decompressData = (compressed: string): any => {
  const binaryString = atob(compressed);
  const data = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    data[i] = binaryString.charCodeAt(i);
  }
  const decompressed = inflate(data);
  const jsonString = new TextDecoder().decode(decompressed);
  return JSON.parse(jsonString);
};

// Gestionnaire de synchronisation
class OfflineSyncManager {
  private pendingChanges: PendingChange[] = [];
  private isOnline: boolean = true;
  private conflictResolutions: Map<string, ConflictResolution> = new Map();
  private queue: MutationQueueItem[] = [];
  private isProcessing: boolean = false;
  private networkListener: any = null;

  constructor() {
    this.initializeNetworkListener();
    this.loadPendingChanges();
    this.loadConflictResolutions();
    this.initializeQueue();
    this.setupNetworkListener();
  }

  private async initializeNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (wasOffline && this.isOnline) {
        this.syncPendingChanges();
      }
    });
  }

  private async loadPendingChanges() {
    try {
      const storedChanges = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_CHANGES);
      if (storedChanges) {
        this.pendingChanges = JSON.parse(storedChanges);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des changements en attente:', error);
    }
  }

  private async savePendingChanges() {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_CHANGES,
        JSON.stringify(this.pendingChanges)
      );
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des changements en attente:', error);
    }
  }

  private async loadConflictResolutions() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CONFLICT_RESOLUTION);
      if (stored) {
        const decompressed = decompressData(stored);
        this.conflictResolutions = new Map(decompressed);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des résolutions de conflits:', error);
    }
  }

  private async saveConflictResolutions() {
    try {
      const compressed = compressData(Array.from(this.conflictResolutions.entries()));
      await AsyncStorage.setItem(STORAGE_KEYS.CONFLICT_RESOLUTION, compressed);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des résolutions de conflits:', error);
    }
  }

  // Détection des conflits
  private async detectConflicts(change: PendingChange): Promise<boolean> {
    const { table, data } = change;
    if (!data.id) return false;

    const { data: remoteData, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', data.id)
      .single();

    if (error || !remoteData) return false;

    // Vérifier si la version distante est plus récente
    return remoteData.version > (change.version || 0);
  }

  // Résolution des conflits
  private async resolveConflict(change: PendingChange, remoteData: any): Promise<any> {
    const entityKey = `${change.table}:${change.data.id}`;
    const existingResolution = this.conflictResolutions.get(entityKey);

    if (existingResolution) {
      return existingResolution.resolution === 'local' ? change.data : remoteData;
    }

    // Stratégie par défaut : la version la plus récente gagne
    const resolution: ConflictResolution = {
      entityId: change.data.id,
      table: change.table,
      resolution: change.timestamp > remoteData.updated_at ? 'local' : 'remote',
      timestamp: Date.now(),
    };

    this.conflictResolutions.set(entityKey, resolution);
    await this.saveConflictResolutions();

    return resolution.resolution === 'local' ? change.data : remoteData;
  }

  // Ajouter un changement en attente
  async addPendingChange(change: Omit<PendingChange, 'id' | 'timestamp'>) {
    const newChange: PendingChange = {
      ...change,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
    };

    this.pendingChanges.push(newChange);
    await this.savePendingChanges();

    if (this.isOnline) {
      this.syncPendingChanges();
    }
  }

  // Synchroniser les changements en attente
  async syncPendingChanges() {
    if (!this.isOnline || this.pendingChanges.length === 0) return;

    const changes = [...this.pendingChanges];
    this.pendingChanges = [];

    for (const change of changes) {
      try {
        const hasConflict = await this.detectConflicts(change);
        if (hasConflict) {
          const { data: remoteData } = await supabase
            .from(change.table)
            .select('*')
            .eq('id', change.data.id)
            .single();

          const resolvedData = await this.resolveConflict(change, remoteData);
          await this.applyChange({ ...change, data: resolvedData });
        } else {
          await this.applyChange(change);
        }
      } catch (error) {
        console.error('Erreur lors de la synchronisation:', error);
        this.pendingChanges.push(change);
      }
    }

    await this.savePendingChanges();
  }

  private async applyChange(change: PendingChange) {
    const { type, table, data } = change;

    switch (type) {
      case 'create':
        await supabase.from(table).insert(data);
        break;
      case 'update':
        await supabase.from(table).update(data).eq('id', data.id);
        break;
      case 'delete':
        await supabase.from(table).delete().eq('id', data.id);
        break;
    }
  }

  // Sauvegarder les données hors ligne avec compression
  async saveOfflineData(data: {
    items?: Item[];
    containers?: Container[];
    categories?: Category[];
  }) {
    try {
      if (data.items) {
        const compressed = compressData(data.items);
        await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_ITEMS, compressed);
      }
      if (data.containers) {
        const compressed = compressData(data.containers);
        await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_CONTAINERS, compressed);
      }
      if (data.categories) {
        const compressed = compressData(data.categories);
        await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_CATEGORIES, compressed);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des données hors ligne:', error);
    }
  }

  // Charger les données hors ligne avec décompression
  async loadOfflineData() {
    try {
      const [itemsCompressed, containersCompressed, categoriesCompressed, lastSync] = 
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_ITEMS),
          AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_CONTAINERS),
          AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_CATEGORIES),
          AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC),
        ]);

      return {
        items: itemsCompressed ? decompressData(itemsCompressed) : [],
        containers: containersCompressed ? decompressData(containersCompressed) : [],
        categories: categoriesCompressed ? decompressData(categoriesCompressed) : [],
        lastSync: lastSync ? parseInt(lastSync) : null,
      };
    } catch (error) {
      console.error('Erreur lors du chargement des données hors ligne:', error);
      return { items: [], containers: [], categories: [], lastSync: null };
    }
  }

  // Vérifier si les données sont périmées
  async isDataStale(maxAge: number = 24 * 60 * 60 * 1000) {
    try {
      const lastSync = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      if (!lastSync) return true;

      const lastSyncTime = parseInt(lastSync);
      return Date.now() - lastSyncTime > maxAge;
    } catch {
      return true;
    }
  }

  private async initializeQueue() {
    try {
      const storedQueue = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (storedQueue) {
        this.queue = JSON.parse(storedQueue);
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de la file d\'attente:', error);
    }
  }

  private setupNetworkListener() {
    this.networkListener = NetInfo.addEventListener(state => {
      if (state.isConnected && !this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async saveQueue() {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la file d\'attente:', error);
    }
  }

  private calculateBackoff(retries: number): number {
    return Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retries), 30000); // Max 30 seconds
  }

  async addToQueue(mutation: Omit<MutationQueueItem, 'id' | 'retries' | 'timestamp'>) {
    const queueItem: MutationQueueItem = {
      ...mutation,
      id: Date.now().toString(),
      retries: 0,
      timestamp: Date.now()
    };

    this.queue.push(queueItem);
    await this.saveQueue();

    const networkState = await NetInfo.fetch();
    if (networkState.isConnected && !this.isProcessing) {
      this.processQueue();
    }
  }

  private async executeMutation(mutation: MutationQueueItem): Promise<boolean> {
    try {
      const { type, table, payload } = mutation;
      
      switch (type) {
        case 'CREATE':
          const { data: createData, error: createError } = await supabase
            .from(table)
            .insert(payload)
            .select()
            .single();
          
          if (createError) throw this.handleError(createError);
          return true;

        case 'UPDATE':
          const { data: updateData, error: updateError } = await supabase
            .from(table)
            .update(payload)
            .eq('id', payload.id)
            .select()
            .single();
          
          if (updateError) throw this.handleError(updateError);
          return true;

        case 'DELETE':
          const { error: deleteError } = await supabase
            .from(table)
            .delete()
            .eq('id', payload.id);
          
          if (deleteError) throw this.handleError(deleteError);
          return true;

        default:
          console.error(`Type de mutation non supporté: ${type}`);
          return false;
      }
    } catch (error) {
      const mutationError = error as MutationError;
      if (!mutationError.retryable) {
        console.error(`Erreur non récupérable pour la mutation ${mutation.id}:`, error);
        return false;
      }
      throw error;
    }
  }

  private handleError(error: any): MutationError {
    // Erreurs retryable
    const retryableErrors = [
      'network_error',
      'timeout',
      'rate_limit',
      'connection_error'
    ];

    return {
      code: error.code || 'unknown',
      message: error.message || 'Une erreur inconnue est survenue',
      retryable: retryableErrors.includes(error.code)
    };
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    try {
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected) {
        this.isProcessing = false;
        return;
      }

      const currentQueue = [...this.queue];
      const failedMutations: MutationQueueItem[] = [];

      for (const mutation of currentQueue) {
        try {
          const success = await this.executeMutation(mutation);

          if (!success) {
            if (mutation.retries < MAX_RETRIES) {
              const backoffDelay = this.calculateBackoff(mutation.retries);
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
              
              mutation.retries++;
              failedMutations.push(mutation);
            } else {
              // Notifier l'échec via un système d'événements
              this.emitSyncError({
                type: 'mutation_failed',
                mutation,
                error: `La mutation a échoué après ${MAX_RETRIES} tentatives`
              });
            }
          }
        } catch (error) {
          const mutationError = error as MutationError;
          if (mutationError.retryable && mutation.retries < MAX_RETRIES) {
            mutation.retries++;
            failedMutations.push(mutation);
          } else {
            this.emitSyncError({
              type: 'mutation_failed',
              mutation,
              error: mutationError.message
            });
          }
        }
      }

      this.queue = failedMutations;
      await this.saveQueue();

      // Si des mutations ont échoué, planifier une nouvelle tentative
      if (failedMutations.length > 0) {
        const nextRetryDelay = Math.min(
          ...failedMutations.map(m => this.calculateBackoff(m.retries))
        );
        setTimeout(() => this.processQueue(), nextRetryDelay);
      }
    } catch (error) {
      console.error('Erreur lors du traitement de la file d\'attente:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private emitSyncError(error: { type: string; mutation: MutationQueueItem; error: string }) {
    // Émettre l'erreur via un système d'événements (à implémenter selon les besoins)
    console.error('Erreur de synchronisation:', error);
  }

  cleanup() {
    if (this.networkListener) {
      this.networkListener();
    }
  }
}

export const offlineSyncManager = new OfflineSyncManager();

// Hooks pour l'utilisation dans les composants
export const useOfflineSync = () => {
  const queueMutation = async (
    type: MutationQueueItem['type'],
    table: string,
    payload: any
  ) => {
    await offlineSyncManager.addToQueue({
      type,
      table,
      payload
    });
  };

  return {
    queueMutation
  };
}; 