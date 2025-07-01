import { localDB } from '../database/localDatabase';

interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  method: string;
}

interface IndexOptimization {
  table: string;
  indexName: string;
  queries: string[];
  usage: number;
  recommendation: 'keep' | 'remove' | 'modify';
}

interface StorageOptimizationReport {
  totalSizeBefore: number;
  totalSizeAfter: number;
  spaceSaved: number;
  compressionResults: CompressionResult[];
  indexOptimizations: IndexOptimization[];
  recommendations: string[];
}

interface OptimizationOptions {
  enableCompression: boolean;
  compressionLevel: 'light' | 'medium' | 'aggressive';
  optimizeIndexes: boolean;
  cleanupThreshold: number; // en jours
  maxStorageSize: number; // en MB
}

const DEFAULT_OPTIMIZATION_OPTIONS: OptimizationOptions = {
  enableCompression: true,
  compressionLevel: 'medium',
  optimizeIndexes: true,
  cleanupThreshold: 30,
  maxStorageSize: 100
};

class StorageOptimizationService {
  private static instance: StorageOptimizationService | null = null;
  private compressionWorker: Worker | null = null;
  private indexUsageStats = new Map<string, { hits: number; lastUsed: Date }>();

  static getInstance(): StorageOptimizationService {
    if (!StorageOptimizationService.instance) {
      StorageOptimizationService.instance = new StorageOptimizationService();
    }
    return StorageOptimizationService.instance;
  }

  /**
   * Initialiser le service d'optimisation
   */
  async initialize(): Promise<void> {
    try {
      // Initialiser le worker de compression si disponible
      if (typeof Worker !== 'undefined') {
        this.initializeCompressionWorker();
      }

      // Charger les statistiques d'utilisation des index
      await this.loadIndexUsageStats();

      console.log('[StorageOptimizationService] Service initialisé');
    } catch (error) {
      console.error('[StorageOptimizationService] Erreur initialisation:', error);
    }
  }

  /**
   * Optimiser le stockage complet
   */
  async optimizeStorage(
    options: Partial<OptimizationOptions> = {}
  ): Promise<StorageOptimizationReport> {
    const opts = { ...DEFAULT_OPTIMIZATION_OPTIONS, ...options };
    
    console.log('[StorageOptimizationService] Début optimisation du stockage');
    
    const startTime = performance.now();
    const sizeBefore = await this.calculateTotalStorageSize();
    
    const report: StorageOptimizationReport = {
      totalSizeBefore: sizeBefore,
      totalSizeAfter: 0,
      spaceSaved: 0,
      compressionResults: [],
      indexOptimizations: [],
      recommendations: []
    };

    try {
      // 1. Compression des données
      if (opts.enableCompression) {
        const compressionResults = await this.compressStoredData(opts.compressionLevel);
        report.compressionResults = compressionResults;
      }

      // 2. Optimisation des index
      if (opts.optimizeIndexes) {
        const indexOptimizations = await this.optimizeIndexes();
        report.indexOptimizations = indexOptimizations;
      }

      // 3. Nettoyage des données anciennes
      await this.cleanupOldData(opts.cleanupThreshold);

      // 4. Défragmentation
      await this.defragmentTables();

      // 5. Calcul des résultats
      const sizeAfter = await this.calculateTotalStorageSize();
      report.totalSizeAfter = sizeAfter;
      report.spaceSaved = sizeBefore - sizeAfter;

      // 6. Génération des recommandations
      report.recommendations = await this.generateOptimizationRecommendations(report, opts);

      const endTime = performance.now();
      console.log(`[StorageOptimizationService] Optimisation terminée en ${(endTime - startTime).toFixed(0)}ms`);
      console.log('Rapport d\'optimisation:', {
        spaceSaved: this.formatBytes(report.spaceSaved),
        compressionRatio: report.compressionResults.reduce((sum, r) => sum + r.compressionRatio, 0) / report.compressionResults.length,
        recommendations: report.recommendations.length
      });

      return report;

    } catch (error) {
      console.error('[StorageOptimizationService] Erreur optimisation:', error);
      throw error;
    }
  }

  /**
   * Compresser les données stockées
   */
  private async compressStoredData(level: 'light' | 'medium' | 'aggressive'): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    const tables = ['items', 'categories', 'containers', 'offlineEvents'];

    for (const tableName of tables) {
      try {
        const result = await this.compressTable(tableName, level);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error(`[StorageOptimizationService] Erreur compression table ${tableName}:`, error);
      }
    }

    return results;
  }

  /**
   * Compresser une table spécifique
   */
  private async compressTable(tableName: string, level: 'light' | 'medium' | 'aggressive'): Promise<CompressionResult | null> {
    try {
      const table = (localDB as unknown as Record<string, Dexie.Table>)[tableName];
      if (!table) return null;

      const allData = await table.toArray();
      if (allData.length === 0) return null;

      const originalSize = this.calculateDataSize(allData);
      
      // Appliquer la compression selon le niveau
      const compressedData = await this.applyCompression(allData, level);
      
      // Remplacer les données dans la table
      await table.clear();
      await table.bulkAdd(compressedData);

      const compressedSize = this.calculateDataSize(compressedData);
      const compressionRatio = compressedSize / originalSize;

      console.log(`[StorageOptimizationService] Table ${tableName} compressée: ${this.formatBytes(originalSize)} → ${this.formatBytes(compressedSize)} (${(compressionRatio * 100).toFixed(1)}%)`);

      return {
        originalSize,
        compressedSize,
        compressionRatio,
        method: `${level}_compression`
      };

    } catch (error) {
      console.error(`[StorageOptimizationService] Erreur compression table ${tableName}:`, error);
      return null;
    }
  }

  /**
   * Appliquer la compression sur un dataset
   */
  private async applyCompression(data: unknown[], level: 'light' | 'medium' | 'aggressive'): Promise<unknown[]> {
    const compressionStrategies = {
      light: this.applyLightCompression.bind(this),
      medium: this.applyMediumCompression.bind(this),
      aggressive: this.applyAggressiveCompression.bind(this)
    };

    return compressionStrategies[level](data);
  }

  /**
   * Compression légère - suppression des champs null/undefined
   */
  private applyLightCompression(data: unknown[]): unknown[] {
    return data.map(item => {
      if (typeof item !== 'object' || item === null) return item;
      
      const compressed: Record<string, unknown> = {};
      const obj = item as Record<string, unknown>;
      
      for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined && value !== '') {
          compressed[key] = value;
        }
      }
      
      return compressed;
    });
  }

  /**
   * Compression moyenne - normalisation et déduplication
   */
  private applyMediumCompression(data: unknown[]): unknown[] {
    // 1. Compression légère
    let compressed = this.applyLightCompression(data);
    
    // 2. Déduplication des valeurs communes
    const commonValues = this.findCommonValues(compressed);
    const valueMap = new Map<string, string>();
    
    // Créer des références courtes pour les valeurs communes
    let refCounter = 0;
    for (const [value, count] of commonValues.entries()) {
      if (count > 5 && value.length > 10) { // Seulement si économie substantielle
        valueMap.set(value, `#ref${refCounter++}`);
      }
    }
    
    // 3. Remplacer les valeurs par des références
    compressed = compressed.map(item => {
      if (typeof item !== 'object' || item === null) return item;
      
      const obj = item as Record<string, unknown>;
      const optimized: Record<string, unknown> = {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && valueMap.has(value)) {
          optimized[key] = valueMap.get(value);
        } else {
          optimized[key] = value;
        }
      }
      
      return optimized;
    });
    
    // Ajouter la table de référence si nécessaire
    if (valueMap.size > 0) {
      compressed.unshift({
        _compressionRefs: Object.fromEntries(
          Array.from(valueMap.entries()).map(([value, ref]) => [ref, value])
        )
      });
    }
    
    return compressed;
  }

  /**
   * Compression agressive - tokenisation et encodage
   */
  private applyAggressiveCompression(data: unknown[]): unknown[] {
    // 1. Compression moyenne
    let compressed = this.applyMediumCompression(data);
    
    // 2. Tokenisation des champs longs
    compressed = compressed.map(item => {
      if (typeof item !== 'object' || item === null) return item;
      
      const obj = item as Record<string, unknown>;
      const tokenized: Record<string, unknown> = {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && value.length > 50) {
          // Tokeniser les chaînes longues
          tokenized[key] = this.tokenizeString(value);
        } else {
          tokenized[key] = value;
        }
      }
      
      return tokenized;
    });
    
    return compressed;
  }

  /**
   * Trouver les valeurs communes dans un dataset
   */
  private findCommonValues(data: unknown[]): Map<string, number> {
    const valueCount = new Map<string, number>();
    
    for (const item of data) {
      if (typeof item !== 'object' || item === null) continue;
      
      const obj = item as Record<string, unknown>;
      for (const value of Object.values(obj)) {
        if (typeof value === 'string') {
          valueCount.set(value, (valueCount.get(value) || 0) + 1);
        }
      }
    }
    
    return valueCount;
  }

  /**
   * Tokeniser une chaîne longue
   */
  private tokenizeString(str: string): string {
    // Implémentation simplifiée - remplacer par une vraie tokenisation
    const words = str.split(' ');
    const commonWords = ['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'à', 'dans', 'sur', 'avec', 'pour'];
    
    return words.map(word => {
      const index = commonWords.indexOf(word.toLowerCase());
      return index >= 0 ? `#${index}` : word;
    }).join(' ');
  }

  /**
   * Optimiser les index des tables
   */
  private async optimizeIndexes(): Promise<IndexOptimization[]> {
    const optimizations: IndexOptimization[] = [];
    
    try {
      // Analyser l'utilisation des index
      const indexUsage = await this.analyzeIndexUsage();
      
      for (const [indexName, stats] of indexUsage.entries()) {
        const optimization: IndexOptimization = {
          table: this.getTableFromIndexName(indexName),
          indexName,
          queries: this.getQueriesForIndex(indexName),
          usage: stats.hits,
          recommendation: this.getIndexRecommendation(stats)
        };
        
        optimizations.push(optimization);
      }
      
      console.log(`[StorageOptimizationService] Analysé ${optimizations.length} index`);
      return optimizations;
      
    } catch (error) {
      console.error('[StorageOptimizationService] Erreur optimisation index:', error);
      return [];
    }
  }

  /**
   * Analyser l'utilisation des index
   */
  private async analyzeIndexUsage(): Promise<Map<string, { hits: number; lastUsed: Date }>> {
    // Dans un vrai système, cela viendrait des métriques de Dexie
    // Pour l'instant, utiliser les stats simulées
    return this.indexUsageStats;
  }

  /**
   * Nettoyer les données anciennes
   */
  private async cleanupOldData(thresholdDays: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - thresholdDays);
    
    try {
      // Nettoyer les événements offline anciens synchronisés
      const cleanedEvents = await localDB.offlineEvents
        .where('status')
        .equals('synced')
        .and(event => new Date(event.timestamp) < cutoffDate)
        .delete();
      
      // Nettoyer les conflits résolus anciens
      const cleanedConflicts = await localDB.conflicts
        .where('resolvedAt')
        .below(cutoffDate.toISOString())
        .delete();
      
      // Nettoyer les métadonnées de sync anciennes
      const cleanedMetadata = await localDB.syncMetadata
        .where('timestamp')
        .below(cutoffDate)
        .delete();
      
      console.log(`[StorageOptimizationService] Nettoyage terminé: ${cleanedEvents + cleanedConflicts + cleanedMetadata} éléments supprimés`);
      
    } catch (error) {
      console.error('[StorageOptimizationService] Erreur nettoyage:', error);
    }
  }

  /**
   * Défragmenter les tables
   */
  private async defragmentTables(): Promise<void> {
    try {
      // Forcer la réorganisation des données en recréant les tables
      const tables = ['items', 'categories', 'containers'];
      
      for (const tableName of tables) {
        const table = (localDB as unknown as Record<string, Dexie.Table>)[tableName];
        if (!table) continue;
        
        const allData = await table.orderBy('id').toArray();
        await table.clear();
        await table.bulkAdd(allData);
      }
      
      console.log('[StorageOptimizationService] Défragmentation terminée');
      
    } catch (error) {
      console.error('[StorageOptimizationService] Erreur défragmentation:', error);
    }
  }

  /**
   * Calculer la taille totale du stockage
   */
  private async calculateTotalStorageSize(): Promise<number> {
    try {
      // Estimation basée sur le contenu des tables
      const [items, categories, containers, events, conflicts, metadata, images] = await Promise.all([
        localDB.items.count(),
        localDB.categories.count(),
        localDB.containers.count(),
        localDB.offlineEvents.count(),
        localDB.conflicts.count(),
        localDB.syncMetadata.count(),
        localDB.imagesBlob.toArray()
      ]);
      
      // Estimation grossière de la taille
      const estimatedSize = 
        (items * 500) +           // 500 bytes par item
        (categories * 200) +      // 200 bytes par catégorie
        (containers * 150) +      // 150 bytes par container
        (events * 800) +          // 800 bytes par événement
        (conflicts * 1500) +      // 1500 bytes par conflit
        (metadata * 300) +        // 300 bytes par métadonnée
        images.reduce((total, img) => total + (img.data ? img.data.byteLength : 0), 0);
      
      return estimatedSize;
      
    } catch (error) {
      console.error('[StorageOptimizationService] Erreur calcul taille:', error);
      return 0;
    }
  }

  /**
   * Calculer la taille d'un dataset
   */
  private calculateDataSize(data: unknown[]): number {
    try {
      return JSON.stringify(data).length * 2; // Estimation UTF-16
    } catch {
      return data.length * 100; // Estimation par défaut
    }
  }

  /**
   * Générer des recommandations d'optimisation
   */
  private async generateOptimizationRecommendations(
    report: StorageOptimizationReport,
    options: OptimizationOptions
  ): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Recommandations basées sur la taille
    if (report.totalSizeAfter > options.maxStorageSize * 1024 * 1024) {
      recommendations.push('Stockage proche de la limite, considérer augmenter la fréquence de nettoyage');
    }
    
    // Recommandations basées sur la compression
    const avgCompressionRatio = report.compressionResults.reduce((sum, r) => sum + r.compressionRatio, 0) / report.compressionResults.length;
    if (avgCompressionRatio > 0.8) {
      recommendations.push('Faible taux de compression, vérifier la qualité des données');
    }
    
    // Recommandations basées sur les index
    const unusedIndexes = report.indexOptimizations.filter(i => i.recommendation === 'remove');
    if (unusedIndexes.length > 0) {
      recommendations.push(`${unusedIndexes.length} index inutilisés détectés, considérer la suppression`);
    }
    
    // Recommandations d'espace sauvé
    if (report.spaceSaved > 1024 * 1024) {
      recommendations.push(`Optimisation réussie: ${this.formatBytes(report.spaceSaved)} d'espace libéré`);
    }
    
    return recommendations;
  }

  /**
   * Utilitaires pour les index
   */
  private getTableFromIndexName(indexName: string): string {
    // Logique pour déterminer la table à partir du nom d'index
    if (indexName.includes('item')) return 'items';
    if (indexName.includes('category')) return 'categories';
    if (indexName.includes('container')) return 'containers';
    return 'unknown';
  }

  private getQueriesForIndex(indexName: string): string[] {
    // Retourner les requêtes typiques pour cet index
    return [`SELECT * WHERE ${indexName}`, `ORDER BY ${indexName}`];
  }

  private getIndexRecommendation(stats: { hits: number; lastUsed: Date }): 'keep' | 'remove' | 'modify' {
    const daysSinceLastUse = (Date.now() - stats.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    
    if (stats.hits === 0 || daysSinceLastUse > 30) return 'remove';
    if (stats.hits < 10) return 'modify';
    return 'keep';
  }

  /**
   * Initialiser le worker de compression
   */
  private initializeCompressionWorker(): void {
    try {
      // Code du worker inline pour éviter les fichiers externes
      const workerCode = `
        self.onmessage = function(e) {
          const { data, method } = e.data;
          
          // Implémentation simple de compression
          let compressed;
          switch(method) {
            case 'light':
              compressed = data.map(item => {
                const clean = {};
                for (const [key, value] of Object.entries(item)) {
                  if (value !== null && value !== undefined) {
                    clean[key] = value;
                  }
                }
                return clean;
              });
              break;
            default:
              compressed = data;
          }
          
          self.postMessage({ compressed });
        };
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.compressionWorker = new Worker(URL.createObjectURL(blob));
      
      console.log('[StorageOptimizationService] Worker de compression initialisé');
      
    } catch (error) {
      console.warn('[StorageOptimizationService] Impossible d\'initialiser le worker:', error);
    }
  }

  /**
   * Charger les statistiques d'utilisation des index
   */
  private async loadIndexUsageStats(): Promise<void> {
    try {
      const savedStats = localStorage.getItem('indexUsageStats');
      if (savedStats) {
        const parsed = JSON.parse(savedStats);
        for (const [key, value] of Object.entries(parsed)) {
          this.indexUsageStats.set(key, {
            hits: (value as { hits: number }).hits,
            lastUsed: new Date((value as { lastUsed: string }).lastUsed)
          });
        }
      }
    } catch (error) {
      console.warn('[StorageOptimizationService] Impossible de charger les stats d\'index:', error);
    }
  }

  /**
   * Sauvegarder les statistiques d'utilisation des index
   */
  private async saveIndexUsageStats(): Promise<void> {
    try {
      const statsObject = Object.fromEntries(
        Array.from(this.indexUsageStats.entries()).map(([key, value]) => [
          key,
          {
            hits: value.hits,
            lastUsed: value.lastUsed.toISOString()
          }
        ])
      );
      localStorage.setItem('indexUsageStats', JSON.stringify(statsObject));
    } catch (error) {
      console.warn('[StorageOptimizationService] Impossible de sauvegarder les stats d\'index:', error);
    }
  }

  /**
   * Enregistrer l'utilisation d'un index
   */
  recordIndexUsage(indexName: string): void {
    const stats = this.indexUsageStats.get(indexName) || { hits: 0, lastUsed: new Date() };
    stats.hits++;
    stats.lastUsed = new Date();
    this.indexUsageStats.set(indexName, stats);
  }

  /**
   * Formater les bytes en unités lisibles
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Nettoyer et libérer les ressources
   */
  cleanup(): void {
    if (this.compressionWorker) {
      this.compressionWorker.terminate();
      this.compressionWorker = null;
    }
    
    this.saveIndexUsageStats();
    console.log('[StorageOptimizationService] Nettoyage terminé');
  }
}

export const storageOptimizationService = StorageOptimizationService.getInstance();
export default StorageOptimizationService;