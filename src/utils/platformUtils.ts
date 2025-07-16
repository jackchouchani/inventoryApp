import { Platform } from 'react-native';

/**
 * Utilitaires pour détecter les plateformes
 */
export const PlatformUtils = {
  /**
   * Détecte si on est sur iOS natif (pas PWA)
   */
  isNativeiOS(): boolean {
    return Platform.OS === 'ios';
  },
  
  /**
   * Détecte si on est sur Android natif (pas PWA)
   */
  isNativeAndroid(): boolean {
    return Platform.OS === 'android';
  },
  
  /**
   * Détecte si on est sur mobile natif (iOS/Android natif)
   */
  isNativeMobile(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  },
  
  /**
   * Détecte si on est sur web (PWA)
   */
  isWeb(): boolean {
    return Platform.OS === 'web';
  },
  
  /**
   * Détecte si on est sur PWA iOS (iOS Safari/Chrome)
   */
  isPWAiOS(): boolean {
    if (Platform.OS !== 'web') return false;
    
    // Vérifier si on est sur iOS via user agent
    if (typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent || '';
      return /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    }
    
    return false;
  },
  
  /**
   * Détecte si on est sur n'importe quel iOS (natif ou PWA)
   */
  isAnyiOS(): boolean {
    return this.isNativeiOS() || this.isPWAiOS();
  }
};