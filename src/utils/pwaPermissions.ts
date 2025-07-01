/**
 * PWA permissions utilities for camera access
 */

export interface CameraInstructions {
  title: string;
  steps: string[];
  troubleshooting?: string[];
}

/**
 * Check if camera permission is granted for PWA
 */
export async function checkCameraPermissionPWA(): Promise<boolean> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return false;
  }

  try {
    // Try to get camera permissions without actually accessing the camera
    const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
    return permissions.state === 'granted';
  } catch (error) {
    console.warn('Cannot check camera permissions:', error);
    // Fallback: try to access camera briefly
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Request camera permission for PWA
 */
export async function requestCameraPermissionPWA(): Promise<boolean> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment' // Prefer back camera
      } 
    });
    
    // Immediately stop the stream as we just needed permission
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Camera permission denied:', error);
    return false;
  }
}

/**
 * Get browser-specific camera permission instructions
 */
export function getCameraInstructionsPWA(): CameraInstructions {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('chrome')) {
    return {
      title: 'Autoriser l\'accès à la caméra dans Chrome',
      steps: [
        'Cliquez sur l\'icône de caméra dans la barre d\'adresse',
        'Sélectionnez "Toujours autoriser"',
        'Rechargez la page si nécessaire'
      ],
      troubleshooting: [
        'Vérifiez que votre caméra n\'est pas utilisée par une autre application',
        'Redémarrez votre navigateur si le problème persiste'
      ]
    };
  } else if (userAgent.includes('firefox')) {
    return {
      title: 'Autoriser l\'accès à la caméra dans Firefox',
      steps: [
        'Cliquez sur l\'icône de caméra dans la barre d\'adresse',
        'Sélectionnez "Autoriser" et cochez "Se souvenir de cette décision"',
        'Rechargez la page'
      ]
    };
  } else if (userAgent.includes('safari')) {
    return {
      title: 'Autoriser l\'accès à la caméra dans Safari',
      steps: [
        'Allez dans Safari > Préférences > Sites web',
        'Sélectionnez "Caméra" dans la barre latérale',
        'Définissez ce site sur "Autoriser"'
      ]
    };
  } else {
    return {
      title: 'Autoriser l\'accès à la caméra',
      steps: [
        'Autorisez l\'accès à la caméra quand votre navigateur le demande',
        'Rechargez la page si nécessaire'
      ]
    };
  }
}