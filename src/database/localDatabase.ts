import Dexie, { Table } from 'dexie';
import { Item } from '../types/item';
import { Category } from '../types/category';
import { Container } from '../types/container';
import { Location } from '../types/location';

// Types pour les entités offline
export interface OfflineEvent {
  id: string; // UUID
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'MOVE' | 'ASSIGN';
  entity: 'item' | 'category' | 'container' | 'location';
  entityId: string | number;
  data: any;
  originalData?: any; // Pour les UPDATE et DELETE
  timestamp: Date;
  userId?: string;
  deviceId: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
  syncAttempts: number;
  lastSyncAttempt?: Date;
  errorMessage?: string;
  metadata?: {
    qrCode?: string;
    conflictReason?: string;
    serverTimestamp?: Date;
    originalQrCode?: string;
    tempImageUrls?: string[];
    parentEntityId?: string | number;
  };
}

export interface SyncMetadata {
  id: string;
  entity: 'item' | 'category' | 'container' | 'location';
  lastSyncTimestamp: Date;
  lastServerTimestamp?: Date;
  totalRecords: number;
  pendingEvents: number;
  conflictEvents: number;
}

export interface ConflictRecord {
  id: string;
  eventId: string;
  type: 'UPDATE_UPDATE' | 'DELETE_UPDATE' | 'MOVE_MOVE' | 'CREATE_CREATE';
  entity: 'item' | 'category' | 'container' | 'location';
  entityId: string | number;
  localData: any;
  serverData: any;
  localTimestamp: Date;
  serverTimestamp: Date;
  resolution?: 'local' | 'server' | 'merge' | 'manual';
  resolvedData?: any;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface ImageBlob {
  id: string; // UUID
  itemId?: number;
  categoryId?: number;
  containerId?: number;
  blob: Blob;
  fileName: string;
  mimeType: string;
  size: number;
  compressed: boolean;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  uploadAttempts: number;
  createdAt: Date;
  r2Url?: string;
  errorMessage?: string;
}

// Interfaces pour les entités locales (miroir des tables Supabase)
export interface ItemLocal extends Omit<Item, 'id'> {
  id: number | string; // Peut être un number (Supabase) ou string (offline UUID)
  isOffline?: boolean;
  lastSyncedAt?: Date;
  localModifiedAt?: Date;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface CategoryLocal extends Omit<Category, 'id'> {
  id: number | string;
  isOffline?: boolean;
  lastSyncedAt?: Date;
  localModifiedAt?: Date;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface ContainerLocal extends Omit<Container, 'id'> {
  id: number | string;
  isOffline?: boolean;
  lastSyncedAt?: Date;
  localModifiedAt?: Date;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface LocationLocal extends Omit<Location, 'id'> {
  id: number | string;
  isOffline?: boolean;
  lastSyncedAt?: Date;
  localModifiedAt?: Date;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export class LocalDatabase extends Dexie {
  // Tables principales (miroir Supabase)
  items!: Table<ItemLocal>;
  categories!: Table<CategoryLocal>;
  containers!: Table<ContainerLocal>;
  locations!: Table<LocationLocal>;
  
  // Tables offline
  offlineEvents!: Table<OfflineEvent>;
  syncMetadata!: Table<SyncMetadata>;
  conflicts!: Table<ConflictRecord>;
  imagesBlob!: Table<ImageBlob>;

  constructor() {
    super('InventoryOfflineDB');
    
    this.version(1).stores({
      // Tables principales avec index optimisés
      items: '&id, qrCode, name, status, containerId, categoryId, locationId, createdAt, updatedAt, isOffline, syncStatus',
      categories: '&id, name, createdAt, updatedAt, isOffline, syncStatus',
      containers: '&id, number, qrCode, name, locationId, createdAt, updatedAt, isOffline, syncStatus',
      locations: '&id, qrCode, name, createdAt, updatedAt, isOffline, syncStatus',
      
      // Tables offline
      offlineEvents: '&id, type, entity, entityId, timestamp, status, syncAttempts, userId, deviceId',
      syncMetadata: '&id, entity, lastSyncTimestamp, pendingEvents, conflictEvents',
      conflicts: '&id, eventId, type, entity, entityId, localTimestamp, serverTimestamp, resolution',
      imagesBlob: '&id, itemId, categoryId, containerId, uploadStatus, createdAt, uploadAttempts'
    });

    // Hooks pour tracer les modifications
    this.items.hook('creating', this.onLocalChange.bind(this, 'item', 'CREATE'));
    this.items.hook('updating', this.onLocalChange.bind(this, 'item', 'UPDATE'));
    this.items.hook('deleting', this.onLocalChange.bind(this, 'item', 'DELETE'));
    
    this.categories.hook('creating', this.onLocalChange.bind(this, 'category', 'CREATE'));
    this.categories.hook('updating', this.onLocalChange.bind(this, 'category', 'UPDATE'));
    this.categories.hook('deleting', this.onLocalChange.bind(this, 'category', 'DELETE'));
    
    this.containers.hook('creating', this.onLocalChange.bind(this, 'container', 'CREATE'));
    this.containers.hook('updating', this.onLocalChange.bind(this, 'container', 'UPDATE'));
    this.containers.hook('deleting', this.onLocalChange.bind(this, 'container', 'DELETE'));
    
    this.locations.hook('creating', this.onLocalChange.bind(this, 'location', 'CREATE'));
    this.locations.hook('updating', this.onLocalChange.bind(this, 'location', 'UPDATE'));
    this.locations.hook('deleting', this.onLocalChange.bind(this, 'location', 'DELETE'));
  }

  private async onLocalChange(
    entity: 'item' | 'category' | 'container' | 'location',
    type: 'CREATE' | 'UPDATE' | 'DELETE',
    _primKey: any,
    _obj: any,
    _trans: any
  ) {
    // Cette méthode sera appelée automatiquement lors des modifications
    // Elle pourra être utilisée pour créer des événements offline automatiquement
  }

  // Méthodes utilitaires pour la synchronisation
  async getUnsyncedEvents(): Promise<OfflineEvent[]> {
    return await this.offlineEvents
      .where('status')
      .anyOf(['pending', 'failed'])
      .sortBy('timestamp');
  }

  async getEventsByEntity(entity: 'item' | 'category' | 'container' | 'location'): Promise<OfflineEvent[]> {
    return await this.offlineEvents
      .where('entity')
      .equals(entity)
      .sortBy('timestamp');
  }

  async getConflicts(): Promise<ConflictRecord[]> {
    return await this.conflicts
      .filter(conflict => conflict.resolution === undefined)
      .toArray();
  }

  async getPendingImages(): Promise<ImageBlob[]> {
    return await this.imagesBlob
      .where('uploadStatus')
      .anyOf(['pending', 'failed'])
      .toArray();
  }

  // Méthodes pour la gestion des IDs offline
  generateOfflineId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  isOfflineId(id: string | number): boolean {
    return typeof id === 'string' && id.startsWith('offline_');
  }

  // Nettoyage et maintenance
  async cleanupOldData(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    await this.transaction('rw', [this.offlineEvents, this.conflicts], async () => {
      // Supprimer les événements synchronisés anciens
      await this.offlineEvents
        .where('status')
        .equals('synced')
        .and(event => event.timestamp < cutoffDate)
        .delete();

      // Supprimer les conflits résolus anciens
      await this.conflicts
        .where('resolvedAt')
        .below(cutoffDate)
        .delete();
    });
  }

  async getStorageStats(): Promise<{
    totalSize: number;
    itemsCount: number;
    categoriesCount: number;
    containersCount: number;
    locationsCount: number;
    eventsCount: number;
    conflictsCount: number;
    imagesCount: number;
    imagesBlobSize: number;
  }> {
    const [
      itemsCount,
      categoriesCount,
      containersCount,
      locationsCount,
      eventsCount,
      conflictsCount,
      images
    ] = await Promise.all([
      this.items.count(),
      this.categories.count(),
      this.containers.count(),
      this.locations.count(),
      this.offlineEvents.count(),
      this.conflicts.count(),
      this.imagesBlob.toArray()
    ]);

    const imagesBlobSize = images.reduce((total, img) => total + img.size, 0);

    return {
      totalSize: 0, // TODO: Calculer la taille réelle de la DB
      itemsCount,
      categoriesCount,
      containersCount,
      locationsCount,
      eventsCount,
      conflictsCount,
      imagesCount: images.length,
      imagesBlobSize
    };
  }

  async clearAllData(): Promise<void> {
    await this.transaction('rw', 
      [this.items, this.categories, this.containers, this.locations, this.offlineEvents, this.syncMetadata, this.conflicts, this.imagesBlob],
      async () => {
        await this.items.clear();
        await this.categories.clear();
        await this.containers.clear();
        await this.locations.clear();
        await this.offlineEvents.clear();
        await this.syncMetadata.clear();
        await this.conflicts.clear();
        await this.imagesBlob.clear();
      }
    );
  }
}

// Instance singleton
export const localDB = new LocalDatabase();