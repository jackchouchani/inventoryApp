// Types pour le système offline
export type EventType = 'CREATE' | 'UPDATE' | 'DELETE' | 'MOVE' | 'ASSIGN';
export type EntityType = 'item' | 'category' | 'container' | 'location';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
export type ConflictType = 'UPDATE_UPDATE' | 'DELETE_UPDATE' | 'MOVE_MOVE' | 'CREATE_CREATE';
export type ConflictResolution = 'local' | 'server' | 'merge' | 'manual';

export interface OfflineEventMetadata {
  qrCode?: string;
  conflictReason?: string;
  serverTimestamp?: Date;
  originalQrCode?: string; // Pour les QR codes générés offline
  tempImageUrls?: string[]; // URLs temporaires d'images
  parentEntityId?: string | number; // Pour les relations
}

export interface ConflictResolutionStrategy {
  type: ConflictResolution;
  fields?: { [key: string]: 'local' | 'server' | any }; // Pour merge field par field
  reason?: string;
  auto?: boolean; // Résolution automatique ou manuelle
}

export interface SyncOptions {
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  timeoutMs?: number;
  forceSync?: boolean;
  includeImages?: boolean;
}

export interface SyncResult {
  success: boolean;
  syncedEvents: number;
  failedEvents: number;
  conflictsDetected: number;
  conflictsResolved: number;
  errors: SyncError[];
  duration: number;
}

export interface SyncError {
  eventId: string;
  type: 'network' | 'validation' | 'conflict' | 'server' | 'unknown';
  message: string;
  details?: any;
  retryable: boolean;
}

export interface OfflineConfig {
  maxStorageDays: number;
  maxEventQueueSize: number;
  syncInterval: number; // ms
  batchSize: number;
  maxRetries: number;
  autoResolveConflicts: boolean;
  compressionEnabled: boolean;
  debugMode: boolean;
}

export interface DeviceInfo {
  id: string;
  name: string;
  platform: string;
  version: string;
  lastSeen: Date;
}

// Types pour les statistiques offline
export interface OfflineStats {
  totalEvents: number;
  pendingEvents: number;
  syncedEvents: number;
  failedEvents: number;
  conflictsTotal: number;
  conflictsResolved: number;
  lastSyncTime: Date | null;
  offlineDuration: number; // en ms
  storageUsed: number; // en bytes
  imagesQueued: number;
  averageSyncTime: number;
}

// Types pour l'état de synchronisation
export interface SyncState {
  isSync: boolean;
  progress: number; // 0-100
  currentOperation: string;
  remainingEvents: number;
  errors: SyncError[];
  startTime: Date | null;
  estimatedTimeRemaining: number; // en ms
}

// Export des constantes pour utilisation runtime
export const EventTypeValues = ['CREATE', 'UPDATE', 'DELETE', 'MOVE', 'ASSIGN'] as const;
export const EntityTypeValues = ['item', 'category', 'container', 'location'] as const;
export const SyncStatusValues = ['pending', 'syncing', 'synced', 'failed', 'conflict'] as const;
export const ConflictTypeValues = ['UPDATE_UPDATE', 'DELETE_UPDATE', 'MOVE_MOVE', 'CREATE_CREATE'] as const;
export const ConflictResolutionValues = ['local', 'server', 'merge', 'manual'] as const;