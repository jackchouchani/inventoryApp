import { localDB } from '../database/localDatabase';
import { OfflineEvent } from '../types/offline';

interface SyncCheckpoint {
  id: string;
  entity: string;
  lastSyncTimestamp: Date;
  lastSyncedId: string | number;
  syncVersion: number;
  checksum: string;
}

interface DeltaSync {
  entity: string;
  added: unknown[];
  updated: unknown[];
  deleted: string[] | number[];
  conflicts: unknown[];
  checkpoint: SyncCheckpoint;
}

interface IncrementalSyncOptions {
  enableChecksums: boolean;
  maxDeltaSize: number;
  chunkSize: number;
  conflictStrategy: 'server' | 'local' | 'merge';
}

const DEFAULT_INCREMENTAL_OPTIONS: IncrementalSyncOptions = {
  enableChecksums: true,
  maxDeltaSize: 1000,
  chunkSize: 100,
  conflictStrategy: 'merge'
};

class IncrementalSyncService {
  private static instance: IncrementalSyncService | null = null;
  private checkpoints = new Map<string, SyncCheckpoint>();

  static getInstance(): IncrementalSyncService {
    if (!IncrementalSyncService.instance) {
      IncrementalSyncService.instance = new IncrementalSyncService();
    }
    return IncrementalSyncService.instance;
  }

  /**
   * Initialiser le service avec les checkpoints sauvegardés
   */
  async initialize(): Promise<void> {
    try {
      const savedCheckpoints = await localDB.syncMetadata
        .where('type')
        .equals('checkpoint')
        .toArray();

      for (const checkpoint of savedCheckpoints) {
        this.checkpoints.set(
          checkpoint.entityType,
          JSON.parse(checkpoint.data)
        );
      }

      console.log(`[IncrementalSyncService] Initialisé avec ${this.checkpoints.size} checkpoints`);
    } catch (error) {
      console.error('[IncrementalSyncService] Erreur initialisation:', error);
    }
  }

  /**
   * Effectuer une synchronisation incrémentale pour une entité
   */
  async syncEntity(
    entityType: string,
    options: Partial<IncrementalSyncOptions> = {}
  ): Promise<DeltaSync> {
    const syncOptions = { ...DEFAULT_INCREMENTAL_OPTIONS, ...options };
    
    console.log(`[IncrementalSyncService] Début sync incrémentale pour ${entityType}`);

    try {
      // 1. Obtenir ou créer le checkpoint
      const checkpoint = await this.getOrCreateCheckpoint(entityType);
      
      // 2. Calculer les changements locaux depuis le dernier checkpoint
      const localChanges = await this.calculateLocalChanges(entityType, checkpoint);
      
      // 3. Obtenir les changements du serveur
      const serverChanges = await this.fetchServerChanges(entityType, checkpoint);
      
      // 4. Détecter les conflits
      const conflicts = await this.detectIncrementalConflicts(localChanges, serverChanges);
      
      // 5. Appliquer les changements
      const deltaSync = await this.applyIncrementalChanges(
        entityType,
        localChanges,
        serverChanges,
        conflicts,
        syncOptions
      );
      
      // 6. Mettre à jour le checkpoint
      await this.updateCheckpoint(entityType, deltaSync.checkpoint);
      
      console.log(`[IncrementalSyncService] Sync ${entityType} terminée:`, {
        added: deltaSync.added.length,
        updated: deltaSync.updated.length,
        deleted: deltaSync.deleted.length,
        conflicts: deltaSync.conflicts.length
      });

      return deltaSync;

    } catch (error) {
      console.error(`[IncrementalSyncService] Erreur sync ${entityType}:`, error);
      throw error;
    }
  }

  /**
   * Obtenir ou créer un checkpoint pour une entité
   */
  private async getOrCreateCheckpoint(entityType: string): Promise<SyncCheckpoint> {
    let checkpoint = this.checkpoints.get(entityType);
    
    if (!checkpoint) {
      // Créer un nouveau checkpoint
      checkpoint = {
        id: `checkpoint_${entityType}_${Date.now()}`,
        entity: entityType,
        lastSyncTimestamp: new Date(0), // Epoch pour premier sync
        lastSyncedId: '',
        syncVersion: 1,
        checksum: ''
      };
      
      this.checkpoints.set(entityType, checkpoint);
    }
    
    return checkpoint;
  }

  /**
   * Calculer les changements locaux depuis le dernier checkpoint
   */
  private async calculateLocalChanges(
    entityType: string,
    checkpoint: SyncCheckpoint
  ): Promise<{ added: unknown[]; updated: unknown[]; deleted: unknown[] }> {
    const changes = { added: [], updated: [], deleted: [] };

    try {
      const table = this.getTableForEntity(entityType);
      
      // Obtenir tous les éléments modifiés depuis le checkpoint
      const modifiedItems = await table
        .where('updatedAt')
        .above(checkpoint.lastSyncTimestamp.toISOString())
        .toArray();

      for (const item of modifiedItems) {
        if (item.createdAt > checkpoint.lastSyncTimestamp.toISOString()) {
          changes.added.push(item);
        } else {
          changes.updated.push(item);
        }
      }

      // Pour les suppressions, on vérifie les événements offline
      const deletionEvents = await localDB.offlineEvents
        .where(['entity', 'type'])
        .equals([entityType, 'DELETE'])
        .and(event => new Date(event.timestamp) > checkpoint.lastSyncTimestamp)
        .toArray();

      changes.deleted = deletionEvents.map(event => event.entityId);

      console.log(`[IncrementalSyncService] Changements locaux ${entityType}:`, {
        added: changes.added.length,
        updated: changes.updated.length,
        deleted: changes.deleted.length
      });

      return changes;

    } catch (error) {
      console.error(`[IncrementalSyncService] Erreur calcul changements locaux ${entityType}:`, error);
      return changes;
    }
  }

  /**
   * Récupérer les changements du serveur
   */
  private async fetchServerChanges(
    entityType: string,
    checkpoint: SyncCheckpoint
  ): Promise<{ added: unknown[]; updated: unknown[]; deleted: unknown[] }> {
    try {
      const response = await fetch(`/api/sync/incremental/${entityType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lastSyncTimestamp: checkpoint.lastSyncTimestamp.toISOString(),
          lastSyncedId: checkpoint.lastSyncedId,
          syncVersion: checkpoint.syncVersion,
          checksum: checkpoint.checksum
        })
      });

      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }

      const serverChanges = await response.json();
      
      console.log(`[IncrementalSyncService] Changements serveur ${entityType}:`, {
        added: serverChanges.added?.length || 0,
        updated: serverChanges.updated?.length || 0,
        deleted: serverChanges.deleted?.length || 0
      });

      return {
        added: serverChanges.added || [],
        updated: serverChanges.updated || [],
        deleted: serverChanges.deleted || []
      };

    } catch (error) {
      console.error(`[IncrementalSyncService] Erreur récupération serveur ${entityType}:`, error);
      return { added: [], updated: [], deleted: [] };
    }
  }

  /**
   * Détecter les conflits entre changements locaux et serveur
   */
  private async detectIncrementalConflicts(
    localChanges: { added: unknown[]; updated: unknown[]; deleted: unknown[] },
    serverChanges: { added: unknown[]; updated: unknown[]; deleted: unknown[] }
  ): Promise<unknown[]> {
    const conflicts: unknown[] = [];

    // Vérifier les conflits UPDATE-UPDATE
    for (const localUpdate of localChanges.updated) {
      const localItem = localUpdate as { id: string | number; updatedAt: string };
      const serverUpdate = serverChanges.updated.find(
        (item: { id: string | number }) => item.id === localItem.id
      );

      if (serverUpdate) {
        const serverItem = serverUpdate as { id: string | number; updatedAt: string };
        // Conflit si les deux ont été modifiés et que les timestamps diffèrent
        if (localItem.updatedAt !== serverItem.updatedAt) {
          conflicts.push({
            type: 'UPDATE_UPDATE',
            localItem,
            serverItem,
            entityId: localItem.id
          });
        }
      }
    }

    // Vérifier les conflits DELETE-UPDATE
    for (const deletedId of localChanges.deleted) {
      const serverUpdate = serverChanges.updated.find(
        (item: { id: string | number }) => item.id === deletedId
      );

      if (serverUpdate) {
        conflicts.push({
          type: 'DELETE_UPDATE',
          localAction: 'DELETE',
          serverItem: serverUpdate,
          entityId: deletedId
        });
      }
    }

    // Vérifier les conflits UPDATE-DELETE
    for (const localUpdate of localChanges.updated) {
      const localItem = localUpdate as { id: string | number };
      if (serverChanges.deleted.includes(localItem.id)) {
        conflicts.push({
          type: 'UPDATE_DELETE',
          localItem,
          serverAction: 'DELETE',
          entityId: localItem.id
        });
      }
    }

    console.log(`[IncrementalSyncService] ${conflicts.length} conflits détectés`);
    return conflicts;
  }

  /**
   * Appliquer les changements incrémentaux
   */
  private async applyIncrementalChanges(
    entityType: string,
    localChanges: { added: unknown[]; updated: unknown[]; deleted: unknown[] },
    serverChanges: { added: unknown[]; updated: unknown[]; deleted: unknown[] },
    conflicts: unknown[],
    options: IncrementalSyncOptions
  ): Promise<DeltaSync> {
    const table = this.getTableForEntity(entityType);
    const appliedChanges = {
      added: [],
      updated: [],
      deleted: [],
      conflicts: []
    };

    try {
      // 1. Appliquer les ajouts du serveur (pas de conflit possible)
      for (const item of serverChanges.added) {
        await table.put(item);
        appliedChanges.added.push(item);
      }

      // 2. Appliquer les mises à jour du serveur (en évitant les conflits)
      for (const item of serverChanges.updated) {
        const serverItem = item as { id: string | number };
        const hasConflict = conflicts.some(
          (conflict: { entityId: string | number }) => conflict.entityId === serverItem.id
        );

        if (!hasConflict) {
          await table.put(item);
          appliedChanges.updated.push(item);
        }
      }

      // 3. Appliquer les suppressions du serveur (en évitant les conflits)
      for (const deletedId of serverChanges.deleted) {
        const hasConflict = conflicts.some(
          (conflict: { entityId: string | number }) => conflict.entityId === deletedId
        );

        if (!hasConflict) {
          await table.delete(deletedId);
          appliedChanges.deleted.push(deletedId);
        }
      }

      // 4. Gérer les conflits selon la stratégie
      for (const conflict of conflicts) {
        const resolvedConflict = await this.resolveIncrementalConflict(
          conflict,
          options.conflictStrategy,
          table
        );
        appliedChanges.conflicts.push(resolvedConflict);
      }

      // 5. Envoyer les changements locaux au serveur
      await this.pushLocalChangesToServer(entityType, localChanges);

      // 6. Créer le nouveau checkpoint
      const newCheckpoint: SyncCheckpoint = {
        id: `checkpoint_${entityType}_${Date.now()}`,
        entity: entityType,
        lastSyncTimestamp: new Date(),
        lastSyncedId: this.getLastSyncedId(serverChanges),
        syncVersion: this.checkpoints.get(entityType)?.syncVersion || 1 + 1,
        checksum: await this.calculateEntityChecksum(entityType)
      };

      return {
        entity: entityType,
        added: appliedChanges.added,
        updated: appliedChanges.updated,
        deleted: appliedChanges.deleted,
        conflicts: appliedChanges.conflicts,
        checkpoint: newCheckpoint
      };

    } catch (error) {
      console.error(`[IncrementalSyncService] Erreur application changements ${entityType}:`, error);
      throw error;
    }
  }

  /**
   * Résoudre un conflit incrémental
   */
  private async resolveIncrementalConflict(
    conflict: unknown,
    strategy: 'server' | 'local' | 'merge',
    table: Dexie.Table
  ): Promise<unknown> {
    const conflictData = conflict as {
      type: string;
      localItem?: unknown;
      serverItem?: unknown;
      entityId: string | number;
    };

    switch (strategy) {
      case 'server':
        // Toujours prendre la version serveur
        if (conflictData.serverItem) {
          await table.put(conflictData.serverItem);
          return { ...conflictData, resolution: 'server', resolvedItem: conflictData.serverItem };
        }
        break;

      case 'local':
        // Garder la version locale
        if (conflictData.localItem) {
          return { ...conflictData, resolution: 'local', resolvedItem: conflictData.localItem };
        }
        break;

      case 'merge':
        // Fusionner les deux versions
        const mergedItem = await this.mergeConflictedItems(
          conflictData.localItem,
          conflictData.serverItem
        );
        await table.put(mergedItem);
        return { ...conflictData, resolution: 'merge', resolvedItem: mergedItem };
    }

    return conflict;
  }

  /**
   * Fusionner deux versions d'un élément en conflit
   */
  private async mergeConflictedItems(localItem: unknown, serverItem: unknown): Promise<unknown> {
    if (!localItem) return serverItem;
    if (!serverItem) return localItem;

    const local = localItem as Record<string, unknown>;
    const server = serverItem as Record<string, unknown>;

    // Stratégie de fusion simple : prendre les champs les plus récents
    const merged = { ...server }; // Commencer par la version serveur

    // Comparer champ par champ et prendre la version la plus récente
    for (const [key, value] of Object.entries(local)) {
      if (key === 'updatedAt') {
        // Prendre le timestamp le plus récent
        if (new Date(value as string) > new Date(server.updatedAt as string)) {
          merged[key] = value;
        }
      } else if (key !== 'id' && key !== 'createdAt') {
        // Pour les autres champs, prendre la version locale si elle est différente
        if (value !== server[key] && value !== null && value !== undefined) {
          merged[key] = value;
        }
      }
    }

    return merged;
  }

  /**
   * Envoyer les changements locaux au serveur
   */
  private async pushLocalChangesToServer(
    entityType: string,
    localChanges: { added: unknown[]; updated: unknown[]; deleted: unknown[] }
  ): Promise<void> {
    try {
      const response = await fetch(`/api/sync/push/${entityType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(localChanges)
      });

      if (!response.ok) {
        throw new Error(`Erreur push serveur: ${response.status}`);
      }

      console.log(`[IncrementalSyncService] Changements locaux ${entityType} envoyés au serveur`);

    } catch (error) {
      console.error(`[IncrementalSyncService] Erreur push ${entityType}:`, error);
      // Ne pas faire échouer la sync pour une erreur de push
    }
  }

  /**
   * Obtenir la table Dexie pour une entité
   */
  private getTableForEntity(entityType: string): Dexie.Table {
    switch (entityType) {
      case 'item':
        return localDB.items;
      case 'category':
        return localDB.categories;
      case 'container':
        return localDB.containers;
      default:
        throw new Error(`Type d'entité non supporté: ${entityType}`);
    }
  }

  /**
   * Obtenir le dernier ID synchronisé
   */
  private getLastSyncedId(serverChanges: { added: unknown[]; updated: unknown[]; deleted: unknown[] }): string {
    const allItems = [...serverChanges.added, ...serverChanges.updated];
    if (allItems.length === 0) return '';

    // Prendre l'ID le plus récent
    const sortedItems = allItems.sort((a, b) => {
      const itemA = a as { updatedAt: string };
      const itemB = b as { updatedAt: string };
      return new Date(itemB.updatedAt).getTime() - new Date(itemA.updatedAt).getTime();
    });

    return (sortedItems[0] as { id: string }).id;
  }

  /**
   * Calculer le checksum d'une entité
   */
  private async calculateEntityChecksum(entityType: string): Promise<string> {
    try {
      const table = this.getTableForEntity(entityType);
      const allItems = await table.orderBy('id').toArray();
      
      // Créer un hash simple basé sur les IDs et timestamps
      const dataString = allItems
        .map(item => `${(item as { id: string | number }).id}:${(item as { updatedAt: string }).updatedAt}`)
        .join('|');
      
      // Utiliser une fonction de hash simple (dans un vrai cas, utiliser crypto.subtle)
      let hash = 0;
      for (let i = 0; i < dataString.length; i++) {
        const char = dataString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convertir en entier 32 bits
      }
      
      return Math.abs(hash).toString(36);

    } catch (error) {
      console.error(`[IncrementalSyncService] Erreur calcul checksum ${entityType}:`, error);
      return '';
    }
  }

  /**
   * Mettre à jour un checkpoint
   */
  private async updateCheckpoint(entityType: string, checkpoint: SyncCheckpoint): Promise<void> {
    try {
      this.checkpoints.set(entityType, checkpoint);
      
      // Sauvegarder dans la base locale
      await localDB.syncMetadata.put({
        id: `checkpoint_${entityType}`,
        entityType,
        type: 'checkpoint',
        data: JSON.stringify(checkpoint),
        timestamp: new Date()
      });

      console.log(`[IncrementalSyncService] Checkpoint ${entityType} mis à jour`);

    } catch (error) {
      console.error(`[IncrementalSyncService] Erreur mise à jour checkpoint ${entityType}:`, error);
    }
  }

  /**
   * Synchroniser toutes les entités de manière incrémentale
   */
  async syncAllEntitiesIncremental(
    options: Partial<IncrementalSyncOptions> = {}
  ): Promise<DeltaSync[]> {
    const entities = ['item', 'category', 'container'];
    const results: DeltaSync[] = [];

    for (const entity of entities) {
      try {
        const result = await this.syncEntity(entity, options);
        results.push(result);
      } catch (error) {
        console.error(`[IncrementalSyncService] Erreur sync ${entity}:`, error);
        // Continuer avec les autres entités même en cas d'erreur
      }
    }

    return results;
  }

  /**
   * Obtenir les statistiques de synchronisation incrémentale
   */
  getSyncStats(): { entity: string; checkpoint: SyncCheckpoint }[] {
    return Array.from(this.checkpoints.entries()).map(([entity, checkpoint]) => ({
      entity,
      checkpoint
    }));
  }

  /**
   * Réinitialiser les checkpoints (force une synchronisation complète)
   */
  async resetCheckpoints(): Promise<void> {
    this.checkpoints.clear();
    await localDB.syncMetadata.where('type').equals('checkpoint').delete();
    console.log('[IncrementalSyncService] Checkpoints réinitialisés');
  }
}

export const incrementalSyncService = IncrementalSyncService.getInstance();
export default IncrementalSyncService;