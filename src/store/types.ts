import { Item } from '../types/item';
import { SyncState as OfflineSyncState } from '../types/offline';

// Types pour les actions offline
export interface OfflineActionMeta {
  offline?: boolean;
  offlineEventId?: string;
  skipOffline?: boolean;
  offlineError?: string;
}

export interface OfflineMetadata {
  isOffline: boolean;
  lastSyncTime: Date | null;
  pendingEvents: number;
  syncInProgress: boolean;
  syncErrors: string[];
}

export interface ItemsState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  searchResults: Item[];
  selectedItem: Item | null;
  similarItems: Item[];
  currentPage: number;
  totalItems: number;
  hasMore: boolean;
  // Ajout des propriétés offline
  offline: OfflineMetadata;
  localChanges: number;
}

export interface CategoriesState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  // Ajout des propriétés offline
  offline: OfflineMetadata;
  localChanges: number;
}

export interface ContainersState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  loading: boolean;
  // Ajout des propriétés offline
  offline: OfflineMetadata;
  localChanges: number;
}

// Alias pour l'état de synchronisation global (utilise le type d'offline.ts)
export type AppSyncState = OfflineSyncState;

// Types pour les actions avec support offline
export interface OfflineAction<T = any> {
  type: string;
  payload: T;
  meta: OfflineActionMeta & {
    arg: any;
    requestId: string;
    requestStatus: 'pending' | 'fulfilled' | 'rejected';
  };
}

// Helper type pour les thunks avec support offline
export interface OfflineThunkMeta {
  skipOffline?: boolean;
  forceOffline?: boolean;
  priority?: 'low' | 'normal' | 'high';
  retryCount?: number;
}

// Remove default export with types as values since they're interfaces/types only 