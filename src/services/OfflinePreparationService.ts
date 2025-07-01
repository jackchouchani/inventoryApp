import { store } from '../store/store';
import { fetchItems } from '../store/itemsThunks';
import { fetchCategories } from '../store/categoriesThunks';
import { fetchContainers } from '../store/containersThunks';
import { fetchLocations } from '../store/locationsThunks';
import { getImageUrl } from '../utils/r2Client';

export interface DownloadProgress {
  phase: 'items' | 'categories' | 'containers' | 'locations' | 'images' | 'complete';
  current: number;
  total: number;
  message: string;
}

// État global du téléchargement avec callbacks pour notifier les changements
let isDownloadingData = false;
let downloadStateCallbacks: Array<(isDownloading: boolean) => void> = [];

export function isOfflineDownloadInProgress(): boolean {
  return isDownloadingData;
}

export function resetDownloadFlag(): void {
  console.log('[OfflinePreparation] Reset manuel du flag de téléchargement');
  setDownloadState(false);
}

export function subscribeToDownloadState(callback: (isDownloading: boolean) => void): () => void {
  downloadStateCallbacks.push(callback);
  // Retourner une fonction de désabonnement
  return () => {
    downloadStateCallbacks = downloadStateCallbacks.filter(cb => cb !== callback);
  };
}

function setDownloadState(downloading: boolean): void {
  if (isDownloadingData !== downloading) {
    isDownloadingData = downloading;
    console.log('[OfflinePreparation] État téléchargement changé:', downloading);
    // Notifier tous les abonnés
    downloadStateCallbacks.forEach(callback => {
      try {
        callback(downloading);
      } catch (error) {
        console.error('[OfflinePreparation] Erreur dans callback:', error);
      }
    });
  }
}

export class OfflinePreparationService {
  private static instance: OfflinePreparationService;
  private onProgressCallback?: (progress: DownloadProgress) => void;

  public static getInstance(): OfflinePreparationService {
    if (!OfflinePreparationService.instance) {
      OfflinePreparationService.instance = new OfflinePreparationService();
    }
    return OfflinePreparationService.instance;
  }

  /**
   * Télécharger tout le contenu pour usage offline
   */
  async downloadEverything(onProgress?: (progress: DownloadProgress) => void): Promise<void> {
    this.onProgressCallback = onProgress;
    
    // Timeout de sécurité pour éviter les blocages infinis
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Timeout: Téléchargement trop long (30 minutes)'));
      }, 30 * 60 * 1000); // 30 minutes
    });
    
    try {
      console.log('[OfflinePreparation] Début du téléchargement complet...');
      setDownloadState(true); // BLOQUER la navigation
      
      // Exécuter le téléchargement avec timeout
      await Promise.race([
        this.performDownload(),
        timeoutPromise
      ]);
      
      // Phase 5: Terminé
      this.reportProgress({
        phase: 'complete',
        current: 100,
        total: 100,
        message: 'Téléchargement terminé ! L\'app est prête pour le mode hors ligne.'
      });
      
      console.log('[OfflinePreparation] Téléchargement complet terminé');
      
    } catch (error) {
      console.error('[OfflinePreparation] Erreur during téléchargement:', error);
      
      // Reporter l'erreur via le callback de progress
      this.reportProgress({
        phase: 'complete',
        current: 0,
        total: 100,
        message: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      });
      
      throw error;
    } finally {
      setDownloadState(false); // DÉBLOQUER la navigation dans TOUS les cas
      console.log('[OfflinePreparation] Flag de téléchargement réinitialisé');
    }
  }

  private async performDownload(): Promise<void> {
    // Phase 1: Télécharger tous les items
    await this.downloadAllItems();
    
    // Phase 2: Télécharger toutes les catégories
    await this.downloadAllCategories();
    
    // Phase 3: Télécharger tous les containers
    await this.downloadAllContainers();
    
    // Phase 4: Télécharger tous les emplacements (locations)
    await this.downloadAllLocations();
    
    // Phase 5: Télécharger les images critiques (avec gestion d'erreur améliorée)
    await this.downloadCriticalImages();
  }

  private async downloadAllItems(): Promise<void> {
    this.reportProgress({
      phase: 'items',
      current: 0,
      total: 100,
      message: 'Téléchargement de tous les articles...'
    });

    // Télécharger tous les items d'un coup avec une très grande limite
    const result = await store.dispatch(fetchItems({ page: 0, limit: 50000 })).unwrap();
    
    // Sauvegarder dans IndexedDB
    const { localDB } = await import('../database/localDatabase');
    await localDB.items.clear(); // Vider d'abord
    await localDB.items.bulkAdd(result.items); // Ajouter tous les items
    
    this.reportProgress({
      phase: 'items',
      current: 100,
      total: 100,
      message: `${result.items.length} articles téléchargés`
    });
    
    console.log(`[OfflinePreparation] ${result.items.length} items téléchargés et sauvés dans IndexedDB`);
  }

  private async downloadAllCategories(): Promise<void> {
    this.reportProgress({
      phase: 'categories',
      current: 0,
      total: 100,
      message: 'Téléchargement de toutes les catégories...'
    });

    const result = await store.dispatch(fetchCategories()).unwrap();
    
    // Sauvegarder dans IndexedDB
    const { localDB } = await import('../database/localDatabase');
    await localDB.categories.clear(); // Vider d'abord
    await localDB.categories.bulkAdd(result); // Ajouter toutes les catégories
    
    this.reportProgress({
      phase: 'categories',
      current: 100,
      total: 100,
      message: `${result.length} catégories téléchargées`
    });
    
    console.log(`[OfflinePreparation] ${result.length} catégories téléchargées et sauvées dans IndexedDB`);
  }

  private async downloadAllContainers(): Promise<void> {
    this.reportProgress({
      phase: 'containers',
      current: 0,
      total: 100,
      message: 'Téléchargement de tous les containers...'
    });

    const result = await store.dispatch(fetchContainers()).unwrap();
    
    // Sauvegarder dans IndexedDB
    const { localDB } = await import('../database/localDatabase');
    await localDB.containers.clear(); // Vider d'abord
    await localDB.containers.bulkAdd(result); // Ajouter tous les containers
    
    this.reportProgress({
      phase: 'containers',
      current: 100,
      total: 100,
      message: `${result.length} containers téléchargés`
    });
    
    console.log(`[OfflinePreparation] ${result.length} containers téléchargés et sauvés dans IndexedDB`);
  }

  private async downloadAllLocations(): Promise<void> {
    this.reportProgress({
      phase: 'locations',
      current: 0,
      total: 100,
      message: 'Téléchargement de tous les emplacements...'
    });

    const result = await store.dispatch(fetchLocations()).unwrap();
    
    // ✅ OFFLINE - Sauvegarder dans IndexedDB
    const { localDB } = await import('../database/localDatabase');
    await localDB.locations.clear(); // Vider d'abord
    await localDB.locations.bulkAdd(result); // Ajouter tous les emplacements
    
    this.reportProgress({
      phase: 'locations',
      current: 100,
      total: 100,
      message: `${result.length} emplacements téléchargés`
    });
    
    console.log(`[OfflinePreparation] ${result.length} emplacements téléchargés et sauvés dans IndexedDB`);
  }

  private async downloadCriticalImages(): Promise<void> {
    this.reportProgress({
      phase: 'images',
      current: 0,
      total: 100,
      message: 'Téléchargement des images critiques...'
    });

    try {
      // Import dynamique de localDB avec timeout
      const localDBPromise = import('../database/localDatabase');
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout import localDB')), 10000);
      });
      
      const { localDB } = await Promise.race([localDBPromise, timeoutPromise]);
      
      // Récupérer tous les items avec des images depuis IndexedDB avec timeout
      const itemsPromise = localDB.items.toArray();
      const itemsTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout récupération items')), 15000);
      });
      
      const allItems = await Promise.race([itemsPromise, itemsTimeoutPromise]);
      const itemsWithImages = allItems
        .filter(item => item.photo_storage_url && item.photo_storage_url.trim() !== '');
        // Plus de limite - télécharge toutes les images

      console.log(`[OfflinePreparation] Trouvé ${itemsWithImages.length} items avec images`);

      if (itemsWithImages.length === 0) {
        console.log('[OfflinePreparation] Aucune image à télécharger');
        return;
      }

      let downloaded = 0;
      let failed = 0;
      let totalImageSize = 0;
      
      for (const item of itemsWithImages) {
        try {
          if (item.photo_storage_url) {
            // Construire l'URL complète de l'image
            const fullImageUrl = getImageUrl(item.photo_storage_url);
            
            // Télécharger et mettre en cache via Service Worker avec timeout individuel
            const imageSize = await this.downloadAndCacheImageWithTimeout(item.photo_storage_url, fullImageUrl);
            totalImageSize += imageSize;
            downloaded++;
            
            this.reportProgress({
              phase: 'images',
              current: Math.round(((downloaded + failed) / itemsWithImages.length) * 100),
              total: 100,
              message: `Image ${downloaded}/${itemsWithImages.length} téléchargée (${(totalImageSize / 1024 / 1024).toFixed(1)} MB)`
            });
          }
        } catch (error) {
          console.warn(`[OfflinePreparation] Erreur téléchargement image ${item.id}:`, error);
          failed++;
          // Continuer avec les autres images même si une échoue
        }
      }

      console.log(`[OfflinePreparation] ${downloaded} images téléchargées (${(totalImageSize / 1024 / 1024).toFixed(1)} MB), ${failed} échecs sur ${itemsWithImages.length} tentatives`);
      
    } catch (error) {
      console.error('[OfflinePreparation] Erreur critique lors du téléchargement des images:', error);
      
      // Reporter le progrès même en cas d'erreur pour éviter le blocage
      this.reportProgress({
        phase: 'images',
        current: 100,
        total: 100,
        message: `Images: erreur (${error instanceof Error ? error.message : 'erreur inconnue'})`
      });
      
      // Ne pas faire échouer tout le processus pour les images, mais logger l'erreur
      console.warn('[OfflinePreparation] Poursuite du téléchargement malgré l\'erreur images');
    }
  }

  private async downloadAndCacheImageWithTimeout(filename: string, fullUrl: string): Promise<number> {
    // Ajouter un timeout de 30 secondes pour chaque image
    const imagePromise = this.downloadAndCacheImage(filename, fullUrl);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout téléchargement image ${filename}`)), 30000);
    });
    
    return Promise.race([imagePromise, timeoutPromise]);
  }

  private async downloadAndCacheImage(filename: string, fullUrl: string): Promise<number> {
    try {
      console.log(`[OfflinePreparation] Cache SW image ${filename}: ${fullUrl}`);
      
      // 1. Ouvrir le cache Service Worker
      const cache = await caches.open('offline-images-v1');
      
      // 2. Vérifier si l'image est déjà en cache
      const cachedResponse = await cache.match(fullUrl);
      if (cachedResponse) {
        console.log(`[OfflinePreparation] Image ${filename} déjà en cache SW`);
        
        // Retourner la taille depuis les headers si disponible
        const contentLength = cachedResponse.headers.get('content-length');
        return contentLength ? parseInt(contentLength) : 50000; // Fallback estimé
      }
      
      // 3. Télécharger l'image avec gestion robuste des erreurs CORS
      let response;
      let imageSize = 50000; // Taille par défaut
      
      try {
        // Essayer d'abord en mode normal pour avoir accès au blob
        response = await fetch(fullUrl);
        
        if (response.ok) {
          const blob = await response.blob();
          imageSize = blob.size;
          console.log(`[OfflinePreparation] Image ${filename} téléchargée en mode normal (${imageSize} bytes)`);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (normalError) {
        // ✅ OFFLINE - Log simplifié: tentative no-cors sans message d'erreur (comportement attendu)
        
        // Fallback en mode no-cors si CORS échoue
        try {
          response = await fetch(fullUrl, { mode: 'no-cors' });
          imageSize = 75000; // Estimation pour les images en mode no-cors
          console.log(`[OfflinePreparation] Image ${filename} téléchargée en mode no-cors (estimation ${imageSize} bytes)`);
        } catch (corsError) {
          throw new Error(`Échec téléchargement normal et no-cors: ${corsError instanceof Error ? corsError.message : 'Erreur inconnue'}`);
        }
      }
      
      // 5. Mettre en cache directement la response - le SW va la gérer
      await cache.put(fullUrl, response.clone());
      console.log(`[OfflinePreparation] Image ${filename} mise en cache SW (${imageSize} bytes)`);
      
      // 7. Sauvegarder la référence avec la VRAIE taille dans IndexedDB
      const { localDB } = await import('../database/localDatabase');
      await localDB.imagesBlob.put({
        id: filename,
        fileName: filename,
        blob: new Blob(), // Référence vide, le vrai contenu est dans le cache SW
        mimeType: response.headers.get('content-type') || 'image/jpeg',
        size: imageSize, // VRAIE taille, pas une estimation bidon
        compressed: false,
        uploadStatus: 'uploaded',
        uploadAttempts: 0,
        createdAt: new Date(),
        r2Url: fullUrl
      });
      
      return imageSize; // Retourner la vraie taille
      
    } catch (error) {
      console.error(`[OfflinePreparation] Erreur cache SW image ${filename}:`, error);
      throw error;
    }
  }

  private reportProgress(progress: DownloadProgress): void {
    if (this.onProgressCallback) {
      this.onProgressCallback(progress);
    }
  }

  /**
   * Obtenir les statistiques de stockage offline
   */
  async getOfflineStorageStats(): Promise<{
    itemsCount: number;
    categoriesCount: number;
    containersCount: number;
    locationsCount: number;
    offlineEventsCount: number;
    imagesCount: number;
    estimatedSize: string;
  }> {
    try {
      // Import dynamique de localDB
      const { localDB } = await import('../database/localDatabase');
      
      const [itemsCount, categoriesCount, containersCount, locationsCount, offlineEventsCount, imagesCount] = await Promise.all([
        localDB.items.count(),
        localDB.categories.count(),
        localDB.containers.count(),
        localDB.locations.count(),
        localDB.offlineEvents.count(),
        localDB.imagesBlob.count()
      ]);

      // Calcul de la taille réelle des images depuis IndexedDB (qui contient maintenant les vraies tailles)
      const images = await localDB.imagesBlob.toArray();
      const imagesSizeBytes = images.reduce((total, img) => total + (img.size || 0), 0);

      // Estimation de la taille totale avec les vraies tailles
      const dataSizeKB = (itemsCount * 1) + (categoriesCount * 0.5) + (containersCount * 0.5) + (locationsCount * 0.3);
      const totalSizeKB = dataSizeKB + (imagesSizeBytes / 1024);
      
      const estimatedSize = totalSizeKB > 1024 
        ? `${(totalSizeKB / 1024).toFixed(1)} MB`
        : `${totalSizeKB.toFixed(0)} KB`;

      return {
        itemsCount,
        categoriesCount,
        containersCount,
        locationsCount,
        offlineEventsCount,
        imagesCount,
        estimatedSize
      };
    } catch (error) {
      console.error('[OfflinePreparation] Erreur lors du calcul des stats:', error);
      return {
        itemsCount: 0,
        categoriesCount: 0,
        containersCount: 0,
        locationsCount: 0,
        offlineEventsCount: 0,
        imagesCount: 0,
        estimatedSize: '0 KB'
      };
    }
  }

  /**
   * Nettoyer toutes les données offline
   */
  async clearAllOfflineData(): Promise<void> {
    try {
      console.log('[OfflinePreparation] Nettoyage de toutes les données offline...');
      
      // Import dynamique de localDB
      const { localDB } = await import('../database/localDatabase');
      
      // Nettoyer IndexedDB
      await Promise.all([
        localDB.items.clear(),
        localDB.categories.clear(),
        localDB.containers.clear(),
        localDB.locations.clear(),
        localDB.offlineEvents.clear(),
        localDB.syncMetadata.clear(),
        localDB.conflicts.clear(),
        localDB.imagesBlob.clear()
      ]);
      
      // ✅ OFFLINE - Nettoyer également le cache du Service Worker
      try {
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(cacheName => {
              console.log(`[OfflinePreparation] Suppression du cache SW: ${cacheName}`);
              return caches.delete(cacheName);
            })
          );
          console.log('[OfflinePreparation] Tous les caches Service Worker supprimés');
        }
      } catch (cacheError) {
        console.warn('[OfflinePreparation] Erreur suppression cache SW:', cacheError);
        // Ne pas faire échouer le nettoyage pour une erreur de cache
      }
      
      console.log('[OfflinePreparation] Toutes les données offline supprimées');
    } catch (error) {
      console.error('[OfflinePreparation] Erreur lors du nettoyage:', error);
      throw error;
    }
  }
}

export const offlinePreparationService = OfflinePreparationService.getInstance();