import { localDB, OfflineEvent, ConflictRecord } from '../database/localDatabase';
import { ConflictType, EntityType } from '../types/offline';
import { supabase } from '../config/supabase';
import { v4 as uuidv4 } from 'uuid';

export class ConflictDetector {
  private static instance: ConflictDetector;

  private constructor() {}

  public static getInstance(): ConflictDetector {
    if (!ConflictDetector.instance) {
      ConflictDetector.instance = new ConflictDetector();
    }
    return ConflictDetector.instance;
  }

  /**
   * Détecter tous les conflits pour les événements en attente
   */
  async detectAllConflicts(): Promise<ConflictRecord[]> {
    console.log('[ConflictDetector] Détection de tous les conflits...');
    
    const pendingEvents = await localDB.offlineEvents
      .where('status')
      .equals('pending')
      .toArray();
    
    const conflicts: ConflictRecord[] = [];
    
    for (const event of pendingEvents) {
      const eventConflicts = await this.detectEventConflicts(event);
      conflicts.push(...eventConflicts);
    }
    
    // Sauvegarder les conflits détectés
    for (const conflict of conflicts) {
      await localDB.conflicts.put(conflict);
      
      // Marquer l'événement comme en conflit
      await localDB.offlineEvents.update(conflict.eventId, {
        status: 'conflict'
      });
    }
    
    console.log(`[ConflictDetector] ${conflicts.length} conflits détectés`);
    return conflicts;
  }

  /**
   * Détecter les conflits pour un événement spécifique
   */
  async detectEventConflicts(event: OfflineEvent): Promise<ConflictRecord[]> {
    const conflicts: ConflictRecord[] = [];
    
    try {
      switch (event.type) {
        case 'UPDATE':
          const updateConflicts = await this.detectUpdateConflicts(event);
          conflicts.push(...updateConflicts);
          break;
          
        case 'DELETE':
          const deleteConflicts = await this.detectDeleteConflicts(event);
          conflicts.push(...deleteConflicts);
          break;
          
        case 'CREATE':
          const createConflicts = await this.detectCreateConflicts(event);
          conflicts.push(...createConflicts);
          break;
          
        case 'MOVE':
          const moveConflicts = await this.detectMoveConflicts(event);
          conflicts.push(...moveConflicts);
          break;
          
        default:
          // Pas de détection de conflit pour les autres types pour l'instant
          break;
      }
    } catch (error) {
      console.error('[ConflictDetector] Erreur lors de la détection de conflits:', error);
    }
    
    return conflicts;
  }

  /**
   * Détecter les conflits UPDATE-UPDATE
   */
  private async detectUpdateConflicts(event: OfflineEvent): Promise<ConflictRecord[]> {
    const conflicts: ConflictRecord[] = [];
    
    try {
      // Récupérer la version actuelle de l'entité depuis le serveur
      const serverEntity = await this.getServerEntity(event.entity, event.entityId);
      
      if (!serverEntity) {
        // L'entité n'existe plus sur le serveur - conflit DELETE-UPDATE
        const conflict = await this.createConflict(
          'DELETE_UPDATE',
          event,
          null,
          serverEntity,
          'L\'entité a été supprimée sur le serveur mais modifiée localement'
        );
        conflicts.push(conflict);
        return conflicts;
      }
      
      // Récupérer la version locale au moment de la modification offline
      const localEntity = await this.getLocalEntity(event.entity, event.entityId);
      
      if (!localEntity) {
        console.warn('[ConflictDetector] Entité locale introuvable:', event.entityId);
        return conflicts;
      }
      
      // Comparer les timestamps de modification
      const serverUpdateTime = new Date(serverEntity.updated_at || serverEntity.updatedAt);
      const eventTime = event.timestamp;
      
      // Si le serveur a été modifié après notre événement local, il y a conflit
      if (serverUpdateTime > eventTime) {
        // Détecter les champs modifiés
        const conflictingFields = this.detectFieldConflicts(
          event.originalData || localEntity,
          event.data,
          serverEntity
        );
        
        if (conflictingFields.length > 0) {
          const conflict = await this.createConflict(
            'UPDATE_UPDATE',
            event,
            localEntity,
            serverEntity,
            `Conflits sur les champs: ${conflictingFields.join(', ')}`
          );
          conflicts.push(conflict);
        }
      }
      
    } catch (error) {
      console.error('[ConflictDetector] Erreur lors de la détection de conflits UPDATE:', error);
    }
    
    return conflicts;
  }

  /**
   * Détecter les conflits DELETE-UPDATE
   */
  private async detectDeleteConflicts(event: OfflineEvent): Promise<ConflictRecord[]> {
    const conflicts: ConflictRecord[] = [];
    
    try {
      // Vérifier si l'entité existe encore sur le serveur
      const serverEntity = await this.getServerEntity(event.entity, event.entityId);
      
      if (serverEntity) {
        // Vérifier si elle a été modifiée après notre suppression locale
        const serverUpdateTime = new Date(serverEntity.updated_at || serverEntity.updatedAt);
        const eventTime = event.timestamp;
        
        if (serverUpdateTime > eventTime) {
          const conflict = await this.createConflict(
            'DELETE_UPDATE',
            event,
            event.originalData,
            serverEntity,
            'L\'entité a été modifiée sur le serveur après la suppression locale'
          );
          conflicts.push(conflict);
        }
      }
      
    } catch (error) {
      console.error('[ConflictDetector] Erreur lors de la détection de conflits DELETE:', error);
    }
    
    return conflicts;
  }

  /**
   * Détecter les conflits CREATE-CREATE (doublons)
   */
  private async detectCreateConflicts(event: OfflineEvent): Promise<ConflictRecord[]> {
    const conflicts: ConflictRecord[] = [];
    
    try {
      // Pour les créations, détecter les doublons potentiels basés sur des champs uniques
      const duplicates = await this.findDuplicateEntities(event.entity, event.data);
      
      for (const duplicate of duplicates) {
        const conflict = await this.createConflict(
          'CREATE_CREATE',
          event,
          event.data,
          duplicate,
          'Entité similaire trouvée sur le serveur'
        );
        conflicts.push(conflict);
      }
      
    } catch (error) {
      console.error('[ConflictDetector] Erreur lors de la détection de conflits CREATE:', error);
    }
    
    return conflicts;
  }

  /**
   * Détecter les conflits MOVE-MOVE
   */
  private async detectMoveConflicts(event: OfflineEvent): Promise<ConflictRecord[]> {
    const conflicts: ConflictRecord[] = [];
    
    try {
      // Les conflits de déplacement sont traités comme des conflits d'UPDATE
      return await this.detectUpdateConflicts(event);
      
    } catch (error) {
      console.error('[ConflictDetector] Erreur lors de la détection de conflits MOVE:', error);
    }
    
    return conflicts;
  }

  /**
   * Récupérer une entité depuis le serveur
   */
  private async getServerEntity(
    entity: EntityType, 
    entityId: string | number
  ): Promise<any | null> {
    try {
      const tableName = this.getTableName(entity);
      
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', entityId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // Entité non trouvée
          return null;
        }
        throw error;
      }
      
      return data;
      
    } catch (error) {
      console.error(`[ConflictDetector] Erreur lors de la récupération de ${entity} ${entityId}:`, error);
      return null;
    }
  }

  /**
   * Récupérer une entité depuis la base locale
   */
  private async getLocalEntity(
    entity: EntityType, 
    entityId: string | number
  ): Promise<any | null> {
    try {
      switch (entity) {
        case 'item':
          return await localDB.items.get(entityId);
        case 'category':
          return await localDB.categories.get(entityId);
        case 'container':
          return await localDB.containers.get(entityId);
        default:
          return null;
      }
    } catch (error) {
      console.error(`[ConflictDetector] Erreur lors de la récupération locale de ${entity} ${entityId}:`, error);
      return null;
    }
  }

  /**
   * Détecter les champs en conflit entre versions
   */
  private detectFieldConflicts(
    originalData: any,
    localData: any,
    serverData: any
  ): string[] {
    const conflictingFields: string[] = [];
    
    // Convertir les données serveur au format local pour comparaison
    const normalizedServerData = this.normalizeServerData(serverData);
    
    // Comparer chaque champ modifié localement
    for (const field in localData) {
      if (field === 'id' || field === 'createdAt' || field === 'updatedAt') {
        continue; // Ignorer ces champs
      }
      
      const originalValue = originalData?.[field];
      const localValue = localData[field];
      const serverValue = normalizedServerData[field];
      
      // Si la valeur locale a changé par rapport à l'original
      if (originalValue !== localValue) {
        // Et si la valeur serveur est différente de l'original aussi
        if (originalValue !== serverValue) {
          // Et si les valeurs locale et serveur sont différentes
          if (localValue !== serverValue) {
            conflictingFields.push(field);
          }
        }
      }
    }
    
    return conflictingFields;
  }

  /**
   * Rechercher des entités dupliquées sur le serveur
   */
  private async findDuplicateEntities(
    entity: EntityType, 
    data: any
  ): Promise<any[]> {
    const duplicates: any[] = [];
    
    try {
      const tableName = this.getTableName(entity);
      
      // Rechercher par QR code (champ unique principal)
      if (data.qrCode || data.qr_code) {
        const qrCode = data.qrCode || data.qr_code;
        
        const { data: qrDuplicates, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('qr_code', qrCode);
        
        if (!error && qrDuplicates && qrDuplicates.length > 0) {
          duplicates.push(...qrDuplicates);
        }
      }
      
      // Pour les containers, rechercher aussi par numéro
      if (entity === 'container' && (data.number !== undefined)) {
        const { data: numberDuplicates, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('number', data.number);
        
        if (!error && numberDuplicates && numberDuplicates.length > 0) {
          duplicates.push(...numberDuplicates);
        }
      }
      
      // Rechercher par nom exact (pour détecter les doublons potentiels)
      if (data.name) {
        const { data: nameDuplicates, error } = await supabase
          .from(tableName)
          .select('*')
          .ilike('name', data.name);
        
        if (!error && nameDuplicates && nameDuplicates.length > 0) {
          duplicates.push(...nameDuplicates);
        }
      }
      
      // Dédupliquer par ID
      const uniqueDuplicates = duplicates.filter((item, index, self) => 
        index === self.findIndex(t => t.id === item.id)
      );
      
      return uniqueDuplicates;
      
    } catch (error) {
      console.error(`[ConflictDetector] Erreur lors de la recherche de doublons pour ${entity}:`, error);
      return [];
    }
  }

  /**
   * Créer un enregistrement de conflit
   */
  private async createConflict(
    type: ConflictType,
    event: OfflineEvent,
    localData: any,
    serverData: any,
    reason: string
  ): Promise<ConflictRecord> {
    const conflict: ConflictRecord = {
      id: uuidv4(),
      eventId: event.id,
      type,
      entity: event.entity,
      entityId: event.entityId,
      localData,
      serverData,
      localTimestamp: event.timestamp,
      serverTimestamp: serverData?.updated_at ? new Date(serverData.updated_at) : new Date(),
      resolution: undefined,
      resolvedData: undefined,
      resolvedAt: undefined,
      resolvedBy: undefined
    };
    
    // Ajouter la raison du conflit dans les métadonnées de l'événement
    await localDB.offlineEvents.update(event.id, {
      metadata: {
        ...event.metadata,
        conflictReason: reason
      }
    });
    
    console.log(`[ConflictDetector] Conflit ${type} détecté pour ${event.entity} ${event.entityId}: ${reason}`);
    
    return conflict;
  }

  /**
   * Normaliser les données serveur au format local
   */
  private normalizeServerData(serverData: any): any {
    if (!serverData) return {};
    
    const normalized = { ...serverData };
    
    // Convertir snake_case vers camelCase
    if (normalized.container_id !== undefined) {
      normalized.containerId = normalized.container_id;
      delete normalized.container_id;
    }
    
    if (normalized.category_id !== undefined) {
      normalized.categoryId = normalized.category_id;
      delete normalized.category_id;
    }
    
    if (normalized.location_id !== undefined) {
      normalized.locationId = normalized.location_id;
      delete normalized.location_id;
    }
    
    if (normalized.purchase_price !== undefined) {
      normalized.purchasePrice = normalized.purchase_price;
      delete normalized.purchase_price;
    }
    
    if (normalized.selling_price !== undefined) {
      normalized.sellingPrice = normalized.selling_price;
      delete normalized.selling_price;
    }
    
    if (normalized.qr_code !== undefined) {
      normalized.qrCode = normalized.qr_code;
      delete normalized.qr_code;
    }
    
    if (normalized.created_at !== undefined) {
      normalized.createdAt = normalized.created_at;
      delete normalized.created_at;
    }
    
    if (normalized.updated_at !== undefined) {
      normalized.updatedAt = normalized.updated_at;
      delete normalized.updated_at;
    }
    
    return normalized;
  }

  /**
   * Obtenir le nom de table Supabase pour une entité
   */
  private getTableName(entity: EntityType): string {
    const tableMap = {
      item: 'items',
      category: 'categories',
      container: 'containers',
      location: 'locations'
    };
    return tableMap[entity];
  }

  /**
   * Obtenir tous les conflits non résolus
   */
  async getUnresolvedConflicts(): Promise<ConflictRecord[]> {
    return await localDB.conflicts
      .filter(conflict => !conflict.resolution)
      .toArray();
  }

  /**
   * Obtenir les conflits pour une entité spécifique
   */
  async getConflictsForEntity(
    entity: EntityType, 
    entityId: string | number
  ): Promise<ConflictRecord[]> {
    return await localDB.conflicts
      .where('entity')
      .equals(entity)
      .and(conflict => conflict.entityId === entityId)
      .toArray();
  }

  /**
   * Marquer un conflit comme résolu
   */
  async markConflictResolved(
    conflictId: string,
    resolution: 'local' | 'server' | 'merge' | 'manual',
    resolvedData?: any,
    resolvedBy?: string
  ): Promise<boolean> {
    try {
      const updated = await localDB.conflicts.update(conflictId, {
        resolution,
        resolvedData,
        resolvedAt: new Date(),
        resolvedBy
      });
      
      if (updated) {
        console.log(`[ConflictDetector] Conflit ${conflictId} marqué comme résolu: ${resolution}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`[ConflictDetector] Erreur lors de la résolution du conflit ${conflictId}:`, error);
      return false;
    }
  }

  /**
   * Nettoyer les conflits résolus anciens
   */
  async cleanupResolvedConflicts(daysToKeep: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const deletedCount = await localDB.conflicts
        .where('resolvedAt')
        .below(cutoffDate)
        .delete();
      
      console.log(`[ConflictDetector] ${deletedCount} conflits résolus anciens supprimés`);
      return deletedCount;
    } catch (error) {
      console.error('[ConflictDetector] Erreur lors du nettoyage des conflits:', error);
      return 0;
    }
  }
}