import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Item, Container, Category } from '../database/types';
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

// Compression des données
const compressData = (data: any): string => {
  const jsonString = JSON.stringify(data);
  const compressed = deflate(new TextEncoder().encode(jsonString));
  return btoa(String.fromCharCode.apply(null, compressed));
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

  constructor() {
    this.initializeNetworkListener();
    this.loadPendingChanges();
    this.loadConflictResolutions();
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
}

export const offlineSyncManager = new OfflineSyncManager(); 