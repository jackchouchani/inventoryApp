/**
 * Utilitaires pour gérer les permissions dans les PWA
 */

export interface PWAPermissionStatus {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
  isPWA: boolean;
}

/**
 * Vérifie si l'application fonctionne en mode PWA
 */
export function isPWAMode(): boolean {
  // Vérification pour les PWA installées
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // Vérification pour iOS Safari PWA
  const isIOSStandalone = (window.navigator as any).standalone === true;
  
  // Vérification pour Android PWA
  const isAndroidPWA = document.referrer.includes('android-app://');
  
  // Vérification pour les PWA via URL
  const isPWAFromURL = window.location.search.includes('pwa=true');
  
  return isStandalone || isIOSStandalone || isAndroidPWA || isPWAFromURL;
}

/**
 * Vérifie les permissions de caméra pour les PWA
 */
export async function checkCameraPermissionPWA(): Promise<PWAPermissionStatus> {
  const isPWA = isPWAMode();
  
  const result: PWAPermissionStatus = {
    granted: false,
    denied: false,
    prompt: true,
    isPWA
  };

  // Si ce n'est pas une PWA, retourner un état par défaut
  if (!isPWA) {
    result.granted = true; // Assume granted pour le web normal
    result.prompt = false;
    return result;
  }

  // Vérifier les permissions via l'API Permissions si disponible
  if ('permissions' in navigator) {
    try {
      const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      
      result.granted = permission.state === 'granted';
      result.denied = permission.state === 'denied';
      result.prompt = permission.state === 'prompt';
      
      console.log('Permission caméra PWA:', permission.state);
      
      return result;
    } catch (error) {
      console.warn('Impossible de vérifier les permissions PWA:', error);
    }
  }

  // Fallback : tenter d'accéder à la caméra pour vérifier
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    });
    
    // Si on arrive ici, la permission est accordée
    stream.getTracks().forEach(track => track.stop());
    result.granted = true;
    result.prompt = false;
    
    return result;
  } catch (error: any) {
    console.warn('Test d\'accès caméra PWA échoué:', error);
    
    if (error.name === 'NotAllowedError') {
      result.denied = true;
      result.prompt = false;
    }
    
    return result;
  }
}

/**
 * Demande les permissions de caméra pour les PWA
 */
export async function requestCameraPermissionPWA(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } 
    });
    
    // Arrêter immédiatement le stream après avoir obtenu la permission
    stream.getTracks().forEach(track => track.stop());
    
    console.log('Permission caméra PWA accordée');
    return true;
  } catch (error: any) {
    console.error('Permission caméra PWA refusée:', error);
    return false;
  }
}

/**
 * Affiche des instructions spécifiques pour activer la caméra dans les PWA
 */
export function getCameraInstructionsPWA(): string {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('chrome')) {
    return 'Pour activer la caméra dans cette PWA :\n1. Cliquez sur l\'icône de caméra dans la barre d\'adresse\n2. Sélectionnez "Autoriser"\n3. Rechargez la page';
  }
  
  if (userAgent.includes('firefox')) {
    return 'Pour activer la caméra dans cette PWA :\n1. Cliquez sur l\'icône de bouclier dans la barre d\'adresse\n2. Désactivez la protection contre le pistage pour ce site\n3. Rechargez la page';
  }
  
  if (userAgent.includes('safari')) {
    return 'Pour activer la caméra dans cette PWA :\n1. Allez dans Réglages > Safari > Caméra\n2. Sélectionnez "Autoriser"\n3. Rechargez l\'application';
  }
  
  return 'Pour activer la caméra, autorisez l\'accès dans les paramètres de votre navigateur et rechargez la page.';
} 