/**
 * ✅ MÉTHODE ALTERNATIVE - Téléchargements sans manipulation DOM
 * 
 * Cette méthode évite complètement l'ajout/suppression d'éléments DOM
 * qui pourraient déclencher des reloads non désirés
 */

/**
 * Télécharge un fichier texte en utilisant une approche qui ne manipule pas le DOM
 */
export const downloadTextSafelyAlt = (
  content: string, 
  filename: string, 
  mimeType: string = 'text/plain'
): void => {
  console.log('[DownloadAlt] Starting alternative download for:', filename);
  
  try {
    // Créer le blob
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    
    console.log('[DownloadAlt] Blob URL created:', url.substring(0, 50) + '...');
    
    // ✅ MÉTHODE 1: Utiliser window.open pour éviter la manipulation DOM
    const downloadWindow = window.open(url, '_blank');
    
    if (downloadWindow) {
      console.log('[DownloadAlt] Download window opened successfully');
      
      // ✅ CORRECTION: Laisser l'utilisateur fermer manuellement la fenêtre
      // Nettoyer l'URL seulement après que l'utilisateur ferme la fenêtre
      const checkWindowClosed = () => {
        if (downloadWindow.closed) {
          window.URL.revokeObjectURL(url);
          console.log('[DownloadAlt] Window closed by user, URL cleaned up');
        } else {
          // Vérifier toutes les 500ms si la fenêtre est fermée
          setTimeout(checkWindowClosed, 500);
        }
      };
      
      // Commencer à vérifier après 1 seconde (pour laisser le temps au téléchargement)
      setTimeout(checkWindowClosed, 1000);
    } else {
      // ✅ FALLBACK: Si window.open est bloqué, utiliser l'ancienne méthode
      console.log('[DownloadAlt] Window.open blocked, using fallback method');
      fallbackDownload(blob, filename);
    }
    
  } catch (error) {
    console.error('[DownloadAlt] Error in alternative download:', error);
    throw error;
  }
};

/**
 * Méthode de fallback qui crée temporairement un lien mais le supprime immédiatement
 */
const fallbackDownload = (blob: Blob, filename: string): void => {
  console.log('[DownloadAlt] Using fallback download method');
  
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.position = 'absolute';
  link.style.left = '-9999px'; // Hors écran
  
  // Ajouter, cliquer, supprimer immédiatement
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Nettoyer l'URL après un court délai
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
    console.log('[DownloadAlt] Fallback download completed and cleaned up');
  }, 100);
};

/**
 * Télécharge un blob (PDF, etc.) en utilisant la méthode alternative
 */
export const downloadBlobSafelyAlt = (
  blob: Blob, 
  filename: string
): void => {
  console.log('[DownloadAlt] Starting alternative blob download for:', filename);
  
  try {
    // Créer l'URL du blob
    const url = window.URL.createObjectURL(blob);
    
    console.log('[DownloadAlt] Blob URL created:', url.substring(0, 50) + '...');
    
    // ✅ MÉTHODE: Utiliser window.open pour éviter la manipulation DOM
    const downloadWindow = window.open(url, '_blank');
    
    if (downloadWindow) {
      console.log('[DownloadAlt] Download window opened successfully');
      
      // ✅ Laisser l'utilisateur fermer manuellement la fenêtre
      // Nettoyer l'URL seulement après que l'utilisateur ferme la fenêtre
      const checkWindowClosed = () => {
        if (downloadWindow.closed) {
          window.URL.revokeObjectURL(url);
          console.log('[DownloadAlt] Window closed by user, URL cleaned up');
        } else {
          // Vérifier toutes les 500ms si la fenêtre est fermée
          setTimeout(checkWindowClosed, 500);
        }
      };
      
      // Commencer à vérifier après 1 seconde (pour laisser le temps au téléchargement)
      setTimeout(checkWindowClosed, 1000);
    } else {
      // ✅ FALLBACK: Si window.open est bloqué, utiliser l'ancienne méthode
      console.log('[DownloadAlt] Window.open blocked, using fallback method');
      fallbackDownload(blob, filename);
    }
    
  } catch (error) {
    console.error('[DownloadAlt] Error in alternative blob download:', error);
    throw error;
  }
};