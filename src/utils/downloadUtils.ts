/**
 * ✅ UTILITAIRE GLOBAL - Téléchargements sécurisés
 * 
 * Ce module centralise la logique de téléchargement de fichiers
 * avec nettoyage automatique des ressources pour éviter les memory leaks
 * 
 * Note: Ce module est conçu pour le web uniquement
 */

import { Platform } from 'react-native';

interface DownloadOptions {
  timeout?: number; // Timeout en millisecondes
  cleanup?: boolean; // Forcer le nettoyage immédiat
}

/**
 * Télécharge un blob de manière sécurisée avec nettoyage automatique
 */
export const downloadBlobSafely = (
  blob: Blob, 
  filename: string, 
  options: DownloadOptions = {}
): Promise<void> => {
  const { timeout = 30000, cleanup = true } = options;
  
  return new Promise((resolve, reject) => {
    // Vérification de plateforme
    if (Platform.OS !== 'web') {
      console.warn('[DownloadUtils] Téléchargement ignoré sur mobile');
      resolve();
      return;
    }
    let url: string | null = null;
    let link: HTMLAnchorElement | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const cleanupResources = () => {
      console.log('[DownloadUtils] BEFORE cleanup - Window state check');
      console.log('[DownloadUtils] Window location:', window.location.href);
      console.log('[DownloadUtils] Document readyState:', document.readyState);
      
      if (link && document.body.contains(link)) {
        document.body.removeChild(link);
        console.log('[DownloadUtils] Link removed from DOM');
      }
      if (url) {
        window.URL.revokeObjectURL(url);
        console.log('[DownloadUtils] Object URL revoked');
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      link = null;
      url = null;
      timeoutId = null;
      console.log('[DownloadUtils] AFTER cleanup - Resources cleaned up for:', filename);
      
      // Vérifier si la page va être rechargée
      setTimeout(() => {
        console.log('[DownloadUtils] Post-cleanup check - Window still intact:', window.location.href);
      }, 100);
    };

    try {
      // Créer l'URL du blob
      url = window.URL.createObjectURL(blob);
      
      // Créer le lien de téléchargement
      link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none'; // Assurer que le lien est invisible
      
      // ✅ MÉTHODE ALTERNATIVE: Éviter l'ajout au DOM qui peut causer des problèmes
      // Ajouter au DOM et déclencher le téléchargement
      document.body.appendChild(link);
      
      // Petit délai pour s'assurer que le DOM est prêt
      setTimeout(() => {
        console.log('[DownloadUtils] Triggering download click');
        link.click();
      }, 10);
      
      // Configuration du timeout de sécurité
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          cleanupResources();
          reject(new Error(`Timeout: Le téléchargement de ${filename} a dépassé ${timeout/1000}s`));
        }, timeout);
      }
      
      // Nettoyage immédiat ou différé selon les options
      if (cleanup) {
        // ✅ CORRECTION: Délai plus long pour éviter l'interférence avec l'app
        setTimeout(() => {
          cleanupResources();
          resolve();
        }, 500); // 500ms au lieu de 100ms pour les téléchargements CSV
      } else {
        // Nettoyage différé (pour les cas où on veut garder le contrôle)
        setTimeout(cleanupResources, 5000); // 5s de délai de sécurité
        resolve();
      }
      
    } catch (error) {
      cleanupResources();
      reject(error);
    }
  });
};

/**
 * Télécharge un fichier texte de manière sécurisée
 */
export const downloadTextSafely = (
  content: string, 
  filename: string, 
  mimeType: string = 'text/plain',
  options: DownloadOptions = {}
): Promise<void> => {
  const blob = new Blob([content], { type: mimeType });
  return downloadBlobSafely(blob, filename, options);
};

/**
 * Télécharge un PDF jsPDF de manière sécurisée
 */
export const downloadPDFSafely = (
  pdfDoc: any, // Type jsPDF
  filename: string,
  options: DownloadOptions = {}
): Promise<void> => {
  if (!pdfDoc || typeof pdfDoc.output !== 'function') {
    return Promise.reject(new Error('Document PDF invalide'));
  }
  
  try {
    const pdfBlob = pdfDoc.output('blob');
    return downloadBlobSafely(pdfBlob, filename, options);
  } catch (error) {
    return Promise.reject(error);
  }
};

/**
 * Nettoyage forcé de toutes les ressources de téléchargement en cours
 * Utile en cas d'urgence ou de problème de mémoire
 */
export const forceCleanupDownloads = (): void => {
  console.log('[DownloadUtils] Force cleanup of all download resources');
  
  // Nettoyer tous les liens de téléchargement temporaires
  const downloadLinks = document.querySelectorAll('a[download]');
  downloadLinks.forEach(link => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
  });
  
  // Note: Il n'est pas possible de révoquer tous les Object URLs existants
  // car le navigateur ne nous donne pas accès à la liste complète
  // Mais les URL créées par notre utilitaire sont nettoyées automatiquement
  
  console.log(`[DownloadUtils] Cleaned up ${downloadLinks.length} download links`);
};

/**
 * Monitore l'utilisation de la mémoire et déclenche un nettoyage si nécessaire
 * Fonctionne seulement dans les navigateurs qui supportent performance.memory
 */
export const monitorMemoryAndCleanup = (): void => {
  if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
    const memory = (window.performance as any).memory;
    const usedMB = memory.usedJSHeapSize / 1024 / 1024;
    const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;
    const usagePercent = (usedMB / limitMB) * 100;
    
    console.log(`[DownloadUtils] Memory usage: ${usedMB.toFixed(1)}MB / ${limitMB.toFixed(1)}MB (${usagePercent.toFixed(1)}%)`);
    
    // Si l'utilisation mémoire dépasse 80%, forcer un nettoyage
    if (usagePercent > 80) {
      console.warn('[DownloadUtils] High memory usage detected, forcing cleanup');
      forceCleanupDownloads();
      
      // Suggérer un garbage collection si possible
      if ('gc' in window) {
        (window as any).gc();
      }
    }
  }
};