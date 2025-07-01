import Toast from 'react-native-toast-message';
import { ConflictRecord } from '../database/localDatabase';
import { ConflictDetector } from './ConflictDetector';
import { router } from 'expo-router';

interface ConflictNotificationOptions {
  enableToasts: boolean;
  enablePersistentBanner: boolean;
  autoDetectionInterval: number; // en milliseconds
  maxToastsPerSession: number;
  onConflictDetected?: (conflicts: ConflictRecord[]) => void;
  onConflictResolved?: (conflictId: string) => void;
}

class ConflictNotificationService {
  private static instance: ConflictNotificationService | null = null;
  private isInitialized = false;
  private detectionInterval: NodeJS.Timeout | null = null;
  private toastCount = 0;
  private sessionStartTime = Date.now();
  private lastNotifiedConflicts = new Set<string>();
  
  private options: ConflictNotificationOptions = {
    enableToasts: true,
    enablePersistentBanner: true,
    autoDetectionInterval: 60000, // 1 minute
    maxToastsPerSession: 5,
    onConflictDetected: undefined,
    onConflictResolved: undefined
  };

  private conflictDetector = ConflictDetector.getInstance();

  static getInstance(): ConflictNotificationService {
    if (!ConflictNotificationService.instance) {
      ConflictNotificationService.instance = new ConflictNotificationService();
    }
    return ConflictNotificationService.instance;
  }

  /**
   * Initialiser le service de notifications
   */
  initialize(options: Partial<ConflictNotificationOptions> = {}): void {
    if (this.isInitialized) {
      console.warn('[ConflictNotificationService] Déjà initialisé');
      return;
    }

    this.options = { ...this.options, ...options };
    this.isInitialized = true;
    this.sessionStartTime = Date.now();
    this.toastCount = 0;
    this.lastNotifiedConflicts.clear();

    console.log('[ConflictNotificationService] Initialisé avec options:', this.options);

    // Démarrer la détection automatique si activée
    if (this.options.autoDetectionInterval > 0) {
      this.startAutoDetection();
    }
  }

  /**
   * Arrêter le service
   */
  shutdown(): void {
    this.stopAutoDetection();
    this.isInitialized = false;
    this.lastNotifiedConflicts.clear();
    console.log('[ConflictNotificationService] Service arrêté');
  }

  /**
   * Démarrer la détection automatique
   */
  private startAutoDetection(): void {
    this.stopAutoDetection();

    this.detectionInterval = setInterval(async () => {
      try {
        await this.checkForNewConflicts();
      } catch (error) {
        console.error('[ConflictNotificationService] Erreur détection auto:', error);
      }
    }, this.options.autoDetectionInterval);

    console.log('[ConflictNotificationService] Détection automatique démarrée');
  }

  /**
   * Arrêter la détection automatique
   */
  private stopAutoDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  /**
   * Vérifier les nouveaux conflits
   */
  async checkForNewConflicts(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      const conflicts = await this.conflictDetector.getUnresolvedConflicts();
      const newConflicts = conflicts.filter(c => !this.lastNotifiedConflicts.has(c.id));

      if (newConflicts.length > 0) {
        console.log(`[ConflictNotificationService] ${newConflicts.length} nouveaux conflits détectés`);
        
        // Marquer les conflits comme notifiés
        newConflicts.forEach(c => this.lastNotifiedConflicts.add(c.id));

        // Afficher les notifications
        if (this.options.enableToasts) {
          this.showConflictToast(newConflicts);
        }

        // Appeler le callback personnalisé
        this.options.onConflictDetected?.(newConflicts);
      }

      // Nettoyer les conflits résolus de la liste des notifiés
      const currentConflictIds = new Set(conflicts.map(c => c.id));
      const resolvedConflicts = Array.from(this.lastNotifiedConflicts)
        .filter(id => !currentConflictIds.has(id));

      resolvedConflicts.forEach(id => {
        this.lastNotifiedConflicts.delete(id);
        this.options.onConflictResolved?.(id);
      });

    } catch (error) {
      console.error('[ConflictNotificationService] Erreur vérification conflits:', error);
    }
  }

  /**
   * Afficher un toast pour les nouveaux conflits
   */
  private showConflictToast(conflicts: ConflictRecord[]): void {
    // Limiter le nombre de toasts par session
    if (this.toastCount >= this.options.maxToastsPerSession) {
      console.log('[ConflictNotificationService] Limite de toasts atteinte pour cette session');
      return;
    }

    this.toastCount++;

    const conflictCount = conflicts.length;
    const mostCriticalConflict = this.getMostCriticalConflict(conflicts);
    
    const title = conflictCount === 1 
      ? 'Conflit détecté' 
      : `${conflictCount} conflits détectés`;
    
    const message = this.getConflictDescription(mostCriticalConflict) + 
      (conflictCount > 1 ? ` et ${conflictCount - 1} autre${conflictCount > 2 ? 's' : ''}` : '');

    Toast.show({
      type: 'error',
      text1: title,
      text2: message,
      visibilityTime: 8000,
      autoHide: true,
      topOffset: 60,
      onPress: () => {
        Toast.hide();
        router.push('/(stack)/conflicts');
      },
      props: {
        onTrailingIconPress: () => {
          Toast.hide();
          router.push('/(stack)/conflicts');
        }
      }
    });

    console.log(`[ConflictNotificationService] Toast affiché: ${title}`);
  }

  /**
   * Obtenir le conflit le plus critique
   */
  private getMostCriticalConflict(conflicts: ConflictRecord[]): ConflictRecord {
    // Ordre de priorité des conflits
    const priority = ['DELETE_UPDATE', 'UPDATE_UPDATE', 'CREATE_CREATE', 'MOVE_MOVE'];
    
    for (const type of priority) {
      const conflict = conflicts.find(c => c.type === type);
      if (conflict) return conflict;
    }
    
    return conflicts[0];
  }

  /**
   * Obtenir la description d'un conflit
   */
  private getConflictDescription(conflict: ConflictRecord): string {
    const descriptions = {
      'UPDATE_UPDATE': 'Modifications simultanées',
      'DELETE_UPDATE': 'Suppression vs modification',
      'CREATE_CREATE': 'Création dupliquée',
      'MOVE_MOVE': 'Déplacement simultané'
    };
    
    const typeDesc = descriptions[conflict.type] || conflict.type;
    return `${typeDesc} sur ${conflict.entity}`;
  }

  /**
   * Afficher une notification de conflit résolu
   */
  showConflictResolvedToast(conflictId: string, resolution: string): void {
    if (!this.options.enableToasts) return;

    Toast.show({
      type: 'success',
      text1: 'Conflit résolu',
      text2: `Résolution: ${resolution}`,
      visibilityTime: 4000,
      autoHide: true,
      topOffset: 60
    });

    console.log(`[ConflictNotificationService] Toast résolution affiché pour ${conflictId}`);
  }

  /**
   * Afficher une notification d'erreur de résolution
   */
  showConflictResolutionErrorToast(error: string): void {
    if (!this.options.enableToasts) return;

    Toast.show({
      type: 'error',
      text1: 'Erreur de résolution',
      text2: error,
      visibilityTime: 6000,
      autoHide: true,
      topOffset: 60
    });
  }

  /**
   * Forcer la vérification des conflits
   */
  async forceCheck(): Promise<ConflictRecord[]> {
    console.log('[ConflictNotificationService] Vérification forcée des conflits');
    
    try {
      const conflicts = await this.conflictDetector.detectAllConflicts();
      
      if (conflicts.length > 0) {
        this.showConflictToast(conflicts);
        this.options.onConflictDetected?.(conflicts);
      }
      
      return conflicts;
    } catch (error) {
      console.error('[ConflictNotificationService] Erreur vérification forcée:', error);
      this.showConflictResolutionErrorToast('Impossible de vérifier les conflits');
      return [];
    }
  }

  /**
   * Mettre à jour les options
   */
  updateOptions(newOptions: Partial<ConflictNotificationOptions>): void {
    this.options = { ...this.options, ...newOptions };
    
    // Redémarrer la détection auto si l'intervalle a changé
    if (newOptions.autoDetectionInterval !== undefined) {
      if (this.options.autoDetectionInterval > 0) {
        this.startAutoDetection();
      } else {
        this.stopAutoDetection();
      }
    }
    
    console.log('[ConflictNotificationService] Options mises à jour:', this.options);
  }

  /**
   * Obtenir les statistiques du service
   */
  getStats(): {
    sessionDuration: number;
    toastCount: number;
    notifiedConflicts: number;
    isAutoDetectionActive: boolean;
  } {
    return {
      sessionDuration: Date.now() - this.sessionStartTime,
      toastCount: this.toastCount,
      notifiedConflicts: this.lastNotifiedConflicts.size,
      isAutoDetectionActive: this.detectionInterval !== null
    };
  }

  /**
   * Réinitialiser les compteurs de session
   */
  resetSession(): void {
    this.sessionStartTime = Date.now();
    this.toastCount = 0;
    this.lastNotifiedConflicts.clear();
    console.log('[ConflictNotificationService] Session réinitialisée');
  }
}

export const conflictNotificationService = ConflictNotificationService.getInstance();
export default ConflictNotificationService;