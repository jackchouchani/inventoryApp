import { localDB, ConflictRecord } from '../database/localDatabase';
import { ConflictResolution, ConflictResolutionStrategy } from '../types/offline';
import { ConflictDetector } from './ConflictDetector';

interface ResolutionRule {
  conflictType: string;
  entityType: string;
  field?: string;
  strategy: ConflictResolution;
  priority: number;
  condition?: (localValue: any, serverValue: any, metadata?: any) => boolean;
}

export class ConflictResolver {
  private static instance: ConflictResolver;
  private conflictDetector: ConflictDetector;
  private resolutionRules: ResolutionRule[] = [];

  private constructor() {
    this.conflictDetector = ConflictDetector.getInstance();
    this.initializeDefaultRules();
  }

  public static getInstance(): ConflictResolver {
    if (!ConflictResolver.instance) {
      ConflictResolver.instance = new ConflictResolver();
    }
    return ConflictResolver.instance;
  }

  /**
   * Résoudre automatiquement tous les conflits possibles
   */
  async resolveAllConflictsAutomatically(): Promise<{
    resolved: number;
    failed: number;
    manualRequired: number;
  }> {
    console.log('[ConflictResolver] Résolution automatique de tous les conflits...');
    
    const unresolvedConflicts = await this.conflictDetector.getUnresolvedConflicts();
    
    if (unresolvedConflicts.length === 0) {
      console.log('[ConflictResolver] Aucun conflit à résoudre');
      return { resolved: 0, failed: 0, manualRequired: 0 };
    }
    
    let resolved = 0;
    let failed = 0;
    let manualRequired = 0;
    
    for (const conflict of unresolvedConflicts) {
      try {
        const result = await this.resolveConflictAutomatically(conflict);
        
        if (result.success) {
          if (result.strategy.type === 'manual') {
            manualRequired++;
          } else {
            resolved++;
          }
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`[ConflictResolver] Erreur lors de la résolution du conflit ${conflict.id}:`, error);
        failed++;
      }
    }
    
    console.log(`[ConflictResolver] Résolution terminée: ${resolved} résolus, ${failed} échoués, ${manualRequired} manuels requis`);
    
    return { resolved, failed, manualRequired };
  }

  /**
   * Résoudre automatiquement un conflit spécifique
   */
  async resolveConflictAutomatically(conflict: ConflictRecord): Promise<{
    success: boolean;
    strategy: ConflictResolutionStrategy;
    resolvedData?: any;
    error?: string;
  }> {
    console.log(`[ConflictResolver] Résolution automatique du conflit ${conflict.id}:`, {
      type: conflict.type,
      entity: conflict.entity,
      entityId: conflict.entityId
    });
    
    try {
      // Déterminer la stratégie de résolution
      const strategy = await this.determineResolutionStrategy(conflict);
      
      if (strategy.type === 'manual') {
        console.log(`[ConflictResolver] Résolution manuelle requise pour le conflit ${conflict.id}`);
        return { success: true, strategy };
      }
      
      // Appliquer la stratégie de résolution
      const resolvedData = await this.applyResolutionStrategy(conflict, strategy);
      
      // Marquer le conflit comme résolu
      await this.conflictDetector.markConflictResolved(
        conflict.id,
        strategy.type,
        resolvedData,
        'auto-resolver'
      );
      
      // Appliquer les données résolues localement et/ou sur le serveur
      await this.applyResolvedData(conflict, resolvedData, strategy);
      
      console.log(`[ConflictResolver] Conflit ${conflict.id} résolu avec stratégie ${strategy.type}`);
      
      return { success: true, strategy, resolvedData };
      
    } catch (error) {
      console.error(`[ConflictResolver] Erreur lors de la résolution du conflit ${conflict.id}:`, error);
      return { 
        success: false, 
        strategy: { type: 'manual', reason: (error as Error).message },
        error: (error as Error).message 
      };
    }
  }

  /**
   * Résoudre manuellement un conflit avec une stratégie spécifiée
   */
  async resolveConflictManually(
    conflictId: string,
    strategy: ConflictResolutionStrategy,
    userId?: string
  ): Promise<boolean> {
    try {
      const conflict = await localDB.conflicts.get(conflictId);
      
      if (!conflict) {
        throw new Error(`Conflit ${conflictId} introuvable`);
      }
      
      if (conflict.resolution) {
        throw new Error(`Conflit ${conflictId} déjà résolu`);
      }
      
      // Appliquer la stratégie manuelle
      const resolvedData = await this.applyResolutionStrategy(conflict, strategy);
      
      // Marquer comme résolu
      await this.conflictDetector.markConflictResolved(
        conflictId,
        strategy.type,
        resolvedData,
        userId || 'manual-user'
      );
      
      // Appliquer les données résolues
      await this.applyResolvedData(conflict, resolvedData, strategy);
      
      console.log(`[ConflictResolver] Conflit ${conflictId} résolu manuellement avec stratégie ${strategy.type}`);
      
      return true;
      
    } catch (error) {
      console.error(`[ConflictResolver] Erreur lors de la résolution manuelle du conflit ${conflictId}:`, error);
      return false;
    }
  }

  /**
   * Déterminer la stratégie de résolution pour un conflit
   */
  private async determineResolutionStrategy(conflict: ConflictRecord): Promise<ConflictResolutionStrategy> {
    // Règles spécifiques par type de conflit
    switch (conflict.type) {
      case 'DELETE_UPDATE':
        return await this.resolveDeleteUpdateConflict(conflict);
        
      case 'UPDATE_UPDATE':
        return await this.resolveUpdateUpdateConflict(conflict);
        
      case 'CREATE_CREATE':
        return await this.resolveCreateCreateConflict(conflict);
        
      case 'MOVE_MOVE':
        return await this.resolveMoveConflict(conflict);
        
      default:
        return { 
          type: 'manual', 
          reason: `Type de conflit non supporté: ${conflict.type}` 
        };
    }
  }

  /**
   * Résoudre un conflit DELETE-UPDATE
   */
  private async resolveDeleteUpdateConflict(conflict: ConflictRecord): Promise<ConflictResolutionStrategy> {
    // Règle par défaut: DELETE toujours prioritaire
    const rule = this.findMatchingRule('DELETE_UPDATE', conflict.entity);
    
    if (rule) {
      return { 
        type: rule.strategy,
        auto: true,
        reason: 'Règle automatique: suppression prioritaire'
      };
    }
    
    // Vérifier si c'est une suppression récente vs modification ancienne
    const timeDiff = conflict.serverTimestamp.getTime() - conflict.localTimestamp.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      // Modification serveur très récente, garder la modification
      return { 
        type: 'server',
        auto: true,
        reason: 'Modification serveur récente, annulation de la suppression locale'
      };
    }
    
    // Suppression récente, la privilégier
    return { 
      type: 'local',
      auto: true,
      reason: 'Suppression locale récente privilégiée'
    };
  }

  /**
   * Résoudre un conflit UPDATE-UPDATE
   */
  private async resolveUpdateUpdateConflict(conflict: ConflictRecord): Promise<ConflictResolutionStrategy> {
    const localData = conflict.localData;
    const serverData = conflict.serverData;
    
    // Tentative de merge automatique champ par champ
    const mergeFields: { [key: string]: 'local' | 'server' | any } = {};
    let canAutoMerge = true;
    
    for (const field in localData) {
      if (field === 'id' || field === 'createdAt' || field === 'updatedAt') {
        continue;
      }
      
      const localValue = localData[field];
      const serverValue = serverData[field];
      
      if (localValue !== serverValue) {
        // Appliquer les règles de priorité par champ
        const fieldRule = this.findFieldRule(conflict.entity, field);
        
        if (fieldRule) {
          mergeFields[field] = fieldRule.strategy;
        } else {
          // Règles par défaut selon le type de champ
          const mergeRule = this.getDefaultFieldMergeRule(field, localValue, serverValue);
          
          if (mergeRule) {
            mergeFields[field] = mergeRule;
          } else {
            // Impossible de merger automatiquement ce champ
            canAutoMerge = false;
            break;
          }
        }
      } else {
        // Valeurs identiques, garder l'une ou l'autre
        mergeFields[field] = 'local';
      }
    }
    
    if (canAutoMerge) {
      return {
        type: 'merge',
        fields: mergeFields,
        auto: true,
        reason: 'Merge automatique des champs'
      };
    }
    
    // Fallback: Last-Write-Wins
    const timeDiff = conflict.serverTimestamp.getTime() - conflict.localTimestamp.getTime();
    
    if (timeDiff > 0) {
      return {
        type: 'server',
        auto: true,
        reason: 'Last-Write-Wins: modification serveur plus récente'
      };
    } else {
      return {
        type: 'local',
        auto: true,
        reason: 'Last-Write-Wins: modification locale plus récente'
      };
    }
  }

  /**
   * Résoudre un conflit CREATE-CREATE (doublons)
   */
  private async resolveCreateCreateConflict(conflict: ConflictRecord): Promise<ConflictResolutionStrategy> {
    const localData = conflict.localData;
    const serverData = conflict.serverData;
    
    // Vérifier si c'est vraiment un doublon exact
    const similarity = this.calculateDataSimilarity(localData, serverData);
    
    if (similarity > 0.9) {
      // Très similaire, utiliser l'entité serveur et supprimer la locale
      return {
        type: 'server',
        auto: true,
        reason: `Doublon détecté (similarité: ${Math.round(similarity * 100)}%)`
      };
    }
    
    if (similarity > 0.7) {
      // Similarité modérée, merger si possible
      return {
        type: 'merge',
        auto: false,
        reason: `Entités similaires (${Math.round(similarity * 100)}%), merge manuel requis`
      };
    }
    
    // Entités différentes malgré des champs communs, garder les deux
    return {
      type: 'local',
      auto: true,
      reason: 'Entités suffisamment différentes, création locale maintenue'
    };
  }

  /**
   * Résoudre un conflit de déplacement
   */
  private async resolveMoveConflict(conflict: ConflictRecord): Promise<ConflictResolutionStrategy> {
    // Les conflits MOVE sont traités comme des UPDATE-UPDATE
    return await this.resolveUpdateUpdateConflict(conflict);
  }

  /**
   * Appliquer une stratégie de résolution et retourner les données résolues
   */
  private async applyResolutionStrategy(
    conflict: ConflictRecord,
    strategy: ConflictResolutionStrategy
  ): Promise<any> {
    switch (strategy.type) {
      case 'local':
        return conflict.localData;
        
      case 'server':
        return conflict.serverData;
        
      case 'merge':
        return this.mergeData(conflict.localData, conflict.serverData, strategy.fields || {});
        
      case 'manual':
        // Pas de données résolues pour la résolution manuelle
        return null;
        
      default:
        throw new Error(`Stratégie de résolution non supportée: ${strategy.type}`);
    }
  }

  /**
   * Merger deux objets de données selon les règles spécifiées
   */
  private mergeData(
    localData: any,
    serverData: any,
    fieldRules: { [key: string]: 'local' | 'server' | any }
  ): any {
    const merged = { ...serverData }; // Commencer par les données serveur
    
    // Appliquer les règles champ par champ
    for (const [field, rule] of Object.entries(fieldRules)) {
      if (rule === 'local') {
        merged[field] = localData[field];
      } else if (rule === 'server') {
        merged[field] = serverData[field];
      } else {
        // Valeur spécifique fournie
        merged[field] = rule;
      }
    }
    
    // S'assurer que l'ID et les timestamps sont corrects
    merged.id = serverData.id || localData.id;
    merged.updatedAt = new Date();
    
    return merged;
  }

  /**
   * Appliquer les données résolues localement et/ou sur le serveur
   */
  private async applyResolvedData(
    conflict: ConflictRecord,
    resolvedData: any,
    strategy: ConflictResolutionStrategy
  ): Promise<void> {
    if (!resolvedData) return;
    
    try {
      // Mettre à jour la base locale
      await this.updateLocalEntity(conflict.entity, resolvedData);
      
      // Marquer l'événement offline comme résolu
      await localDB.offlineEvents.update(conflict.eventId, {
        status: 'synced',
        metadata: {
          ...conflict.localData.metadata,
          resolvedBy: strategy.type,
          resolvedAt: new Date()
        }
      });
      
      console.log(`[ConflictResolver] Données résolues appliquées pour ${conflict.entity} ${conflict.entityId}`);
      
    } catch (error) {
      console.error('[ConflictResolver] Erreur lors de l\'application des données résolues:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour une entité dans la base locale
   */
  private async updateLocalEntity(entity: string, data: any): Promise<void> {
    switch (entity) {
      case 'item':
        await localDB.items.put(data);
        break;
      case 'category':
        await localDB.categories.put(data);
        break;
      case 'container':
        await localDB.containers.put(data);
        break;
      default:
        throw new Error(`Type d'entité non supporté: ${entity}`);
    }
  }

  /**
   * Calculer la similarité entre deux objets de données
   */
  private calculateDataSimilarity(data1: any, data2: any): number {
    const fields1 = Object.keys(data1);
    const fields2 = Object.keys(data2);
    const allFields = new Set([...fields1, ...fields2]);
    
    let matchingFields = 0;
    let totalFields = 0;
    
    for (const field of allFields) {
      if (field === 'id' || field === 'createdAt' || field === 'updatedAt') {
        continue; // Ignorer ces champs pour la comparaison
      }
      
      totalFields++;
      
      const value1 = data1[field];
      const value2 = data2[field];
      
      if (value1 === value2) {
        matchingFields++;
      } else if (typeof value1 === 'string' && typeof value2 === 'string') {
        // Comparaison approximative pour les chaînes
        const similarity = this.calculateStringSimilarity(value1, value2);
        if (similarity > 0.8) {
          matchingFields += similarity;
        }
      }
    }
    
    return totalFields > 0 ? matchingFields / totalFields : 0;
  }

  /**
   * Calculer la similarité entre deux chaînes
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    
    if (longer.length === 0) return 1;
    
    const editDistance = this.getLevenshteinDistance(str1, str2);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculer la distance de Levenshtein entre deux chaînes
   */
  private getLevenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Obtenir la règle de merge par défaut pour un champ
   */
  private getDefaultFieldMergeRule(
    field: string,
    localValue: any,
    serverValue: any
  ): 'local' | 'server' | null {
    // Règles par défaut selon le type de champ
    switch (field) {
      case 'name':
      case 'description':
        // Préférer la valeur la plus longue (plus d'informations)
        if (typeof localValue === 'string' && typeof serverValue === 'string') {
          return localValue.length >= serverValue.length ? 'local' : 'server';
        }
        break;
        
      case 'price':
      case 'purchasePrice':
      case 'sellingPrice':
        // Préférer la valeur la plus récente (serveur généralement plus à jour)
        return 'server';
        
      case 'status':
        // Règles métier spécifiques pour le statut
        if (localValue === 'sold' && serverValue === 'available') {
          return 'local'; // Vente locale prioritaire
        }
        if (localValue === 'available' && serverValue === 'sold') {
          return 'server'; // Vente serveur prioritaire
        }
        break;
        
      case 'qrCode':
      case 'number':
        // Champs uniques: résolution manuelle requise
        return null;
        
      default:
        // Pour les autres champs, préférer la version serveur
        return 'server';
    }
    
    return null;
  }

  /**
   * Initialiser les règles de résolution par défaut
   */
  private initializeDefaultRules(): void {
    this.resolutionRules = [
      // Règles DELETE-UPDATE
      {
        conflictType: 'DELETE_UPDATE',
        entityType: '*',
        strategy: 'local',
        priority: 1
      },
      
      // Règles pour les prix (toujours serveur)
      {
        conflictType: 'UPDATE_UPDATE',
        entityType: 'item',
        field: 'sellingPrice',
        strategy: 'server',
        priority: 1
      },
      
      // Règles pour le statut vendu
      {
        conflictType: 'UPDATE_UPDATE',
        entityType: 'item',
        field: 'status',
        strategy: 'local',
        priority: 1,
        condition: (localValue, _serverValue) => localValue === 'sold'
      },
      
      // Plus de règles peuvent être ajoutées ici...
    ];
  }

  /**
   * Trouver une règle correspondante
   */
  private findMatchingRule(conflictType: string, entityType: string, field?: string): ResolutionRule | null {
    return this.resolutionRules
      .filter(rule => 
        (rule.conflictType === conflictType || rule.conflictType === '*') &&
        (rule.entityType === entityType || rule.entityType === '*') &&
        (!field || !rule.field || rule.field === field)
      )
      .sort((a, b) => b.priority - a.priority)[0] || null;
  }

  /**
   * Trouver une règle pour un champ spécifique
   */
  private findFieldRule(entityType: string, field: string): ResolutionRule | null {
    return this.findMatchingRule('UPDATE_UPDATE', entityType, field);
  }

  /**
   * Ajouter une règle de résolution personnalisée
   */
  addResolutionRule(rule: ResolutionRule): void {
    this.resolutionRules.push(rule);
    this.resolutionRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Obtenir les statistiques de résolution
   */
  async getResolutionStats(): Promise<{
    totalConflicts: number;
    resolvedAuto: number;
    resolvedManual: number;
    pending: number;
    byType: { [key: string]: number };
  }> {
    const allConflicts = await localDB.conflicts.toArray();
    
    const stats = {
      totalConflicts: allConflicts.length,
      resolvedAuto: 0,
      resolvedManual: 0,
      pending: 0,
      byType: {} as { [key: string]: number }
    };
    
    for (const conflict of allConflicts) {
      // Compter par type
      stats.byType[conflict.type] = (stats.byType[conflict.type] || 0) + 1;
      
      // Compter par statut de résolution
      if (conflict.resolution) {
        if (conflict.resolvedBy?.includes('auto')) {
          stats.resolvedAuto++;
        } else {
          stats.resolvedManual++;
        }
      } else {
        stats.pending++;
      }
    }
    
    return stats;
  }
}