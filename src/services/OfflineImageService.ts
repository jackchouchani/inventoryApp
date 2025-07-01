import { localDB, ImageBlob } from '../database/localDatabase';
import { v4 as uuidv4 } from 'uuid';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: SaveFormat;
}

interface ImageUploadQueue {
  id: string;
  itemId?: number;
  categoryId?: number;
  containerId?: number;
  localUri: string;
  serverUrl?: string;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  uploadAttempts: number;
  priority: 'high' | 'normal' | 'low';
  createdAt: Date;
  errorMessage?: string;
}

export class OfflineImageService {
  private static instance: OfflineImageService;
  private uploadQueue: ImageUploadQueue[] = [];
  private isProcessingQueue = false;
  private readonly DEFAULT_COMPRESSION_OPTIONS: ImageCompressionOptions = {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.8,
    format: SaveFormat.JPEG
  };

  private constructor() {
    this.loadUploadQueue();
    this.startAutoUpload();
  }

  public static getInstance(): OfflineImageService {
    if (!OfflineImageService.instance) {
      OfflineImageService.instance = new OfflineImageService();
    }
    return OfflineImageService.instance;
  }

  /**
   * Traiter une image pour le stockage offline
   */
  async processImageForOffline(
    imageUri: string,
    entityType: 'item' | 'category' | 'container',
    entityId: number | string,
    options: ImageCompressionOptions = {}
  ): Promise<{
    success: boolean;
    localUri?: string;
    blobId?: string;
    error?: string;
  }> {
    try {
      console.log('[OfflineImageService] Traitement image offline:', { imageUri, entityType, entityId });
      
      // Étape 1: Compresser l'image
      const compressionOptions = { ...this.DEFAULT_COMPRESSION_OPTIONS, ...options };
      const compressedImage = await this.compressImage(imageUri, compressionOptions);
      
      if (!compressedImage.success) {
        throw new Error(compressedImage.error || 'Échec de compression');
      }
      
      // Étape 2: Convertir en blob et stocker dans IndexedDB
      const blob = await this.uriToBlob(compressedImage.uri!);
      const blobId = await this.storeBlobInIndexedDB(
        blob,
        entityType,
        entityId,
        compressedImage.fileName!
      );
      
      // Étape 3: Ajouter à la queue d'upload
      await this.addToUploadQueue({
        id: uuidv4(),
        [`${entityType}Id`]: entityId,
        localUri: compressedImage.uri!,
        uploadStatus: 'pending',
        uploadAttempts: 0,
        priority: 'normal',
        createdAt: new Date()
      } as ImageUploadQueue);
      
      console.log('[OfflineImageService] Image traitée avec succès:', blobId);
      
      return {
        success: true,
        localUri: compressedImage.uri!,
        blobId
      };
      
    } catch (error) {
      console.error('[OfflineImageService] Erreur lors du traitement image:', error);
      return {
        success: false,
        error: (error as Error).message || 'Erreur inconnue'
      };
    }
  }

  /**
   * Récupérer une image depuis le stockage offline
   */
  async getOfflineImage(blobId: string): Promise<{
    success: boolean;
    uri?: string;
    error?: string;
  }> {
    try {
      const imageBlob = await localDB.imagesBlob.get(blobId);
      
      if (!imageBlob) {
        return {
          success: false,
          error: 'Image non trouvée'
        };
      }
      
      // Convertir le blob en URI local
      const uri = await this.blobToUri(imageBlob.blob);
      
      return {
        success: true,
        uri
      };
      
    } catch (error) {
      console.error('[OfflineImageService] Erreur lors de la récupération image:', error);
      return {
        success: false,
        error: (error as Error).message || 'Erreur de récupération'
      };
    }
  }

  /**
   * Obtenir l'URI d'affichage pour une image (offline ou online)
   */
  async getDisplayUri(
    serverUrl?: string,
    blobId?: string,
    fallbackUrl?: string
  ): Promise<string | undefined> {
    // Si on a une URL serveur et qu'on est online, l'utiliser
    if (serverUrl && await this.isOnline()) {
      return serverUrl;
    }
    
    // Sinon, essayer de récupérer depuis le stockage offline
    if (blobId) {
      const offlineResult = await this.getOfflineImage(blobId);
      if (offlineResult.success) {
        return offlineResult.uri;
      }
    }
    
    // Fallback vers l'URL de secours
    return fallbackUrl;
  }

  /**
   * Compresser une image
   */
  private async compressImage(
    uri: string,
    options: ImageCompressionOptions
  ): Promise<{
    success: boolean;
    uri?: string;
    fileName?: string;
    error?: string;
  }> {
    try {
      const result = await manipulateAsync(
        uri,
        [
          {
            resize: {
              width: options.maxWidth,
              height: options.maxHeight
            }
          }
        ],
        {
          compress: options.quality,
          format: options.format,
          base64: false
        }
      );
      
      const fileName = `compressed_${Date.now()}.${options.format === SaveFormat.PNG ? 'png' : 'jpg'}`;
      
      return {
        success: true,
        uri: result.uri,
        fileName
      };
      
    } catch (error) {
      console.error('[OfflineImageService] Erreur compression:', error);
      return {
        success: false,
        error: (error as Error).message || 'Erreur de compression'
      };
    }
  }

  /**
   * Convertir une URI en Blob
   */
  private async uriToBlob(uri: string): Promise<Blob> {
    const response = await fetch(uri);
    return await response.blob();
  }

  /**
   * Convertir un Blob en URI
   */
  private async blobToUri(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Stocker un blob dans IndexedDB
   */
  private async storeBlobInIndexedDB(
    blob: Blob,
    entityType: 'item' | 'category' | 'container',
    entityId: number | string,
    fileName: string
  ): Promise<string> {
    const blobId = uuidv4();
    
    const imageBlob: ImageBlob = {
      id: blobId,
      [`${entityType}Id`]: entityId,
      blob,
      fileName,
      mimeType: blob.type,
      size: blob.size,
      compressed: true,
      uploadStatus: 'pending',
      uploadAttempts: 0,
      createdAt: new Date()
    } as ImageBlob;
    
    await localDB.imagesBlob.add(imageBlob);
    
    console.log(`[OfflineImageService] Blob stocké dans IndexedDB: ${blobId}`);
    return blobId;
  }

  /**
   * Ajouter à la queue d'upload
   */
  private async addToUploadQueue(queueItem: ImageUploadQueue): Promise<void> {
    this.uploadQueue.push(queueItem);
    await this.saveUploadQueue();
    
    // Déclencher l'upload si on est online
    if (await this.isOnline() && !this.isProcessingQueue) {
      this.processUploadQueue();
    }
  }

  /**
   * Traiter la queue d'upload
   */
  async processUploadQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      const pendingUploads = this.uploadQueue.filter(item => 
        item.uploadStatus === 'pending' || item.uploadStatus === 'failed'
      ).sort((a, b) => {
        // Priorité puis date de création
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
      
      console.log(`[OfflineImageService] Traitement de ${pendingUploads.length} uploads en attente`);
      
      for (const uploadItem of pendingUploads) {
        try {
          await this.uploadSingleImage(uploadItem);
        } catch (error) {
          console.error(`[OfflineImageService] Échec upload ${uploadItem.id}:`, error);
          
          uploadItem.uploadAttempts++;
          uploadItem.uploadStatus = 'failed';
          uploadItem.errorMessage = (error as Error).message;
          
          // Abandonner après 3 tentatives
          if (uploadItem.uploadAttempts >= 3) {
            console.log(`[OfflineImageService] Upload abandonné après 3 tentatives: ${uploadItem.id}`);
          }
        }
      }
      
      await this.saveUploadQueue();
      
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Upload d'une image unique
   */
  private async uploadSingleImage(uploadItem: ImageUploadQueue): Promise<void> {
    console.log(`[OfflineImageService] Upload de l'image ${uploadItem.id}...`);
    
    uploadItem.uploadStatus = 'uploading';
    await this.saveUploadQueue();
    
    // TODO: Implémenter l'upload vers R2/Supabase Storage
    // Pour l'instant, simuler un upload réussi
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    uploadItem.uploadStatus = 'uploaded';
    uploadItem.serverUrl = `https://storage.example.com/images/${uploadItem.id}.jpg`;
    
    // Mettre à jour la base locale avec l'URL serveur
    await this.updateEntityWithServerUrl(uploadItem);
    
    console.log(`[OfflineImageService] Upload réussi: ${uploadItem.id}`);
  }

  /**
   * Mettre à jour l'entité avec l'URL serveur
   */
  private async updateEntityWithServerUrl(uploadItem: ImageUploadQueue): Promise<void> {
    try {
      if (uploadItem.itemId) {
        await localDB.items.update(uploadItem.itemId, {
          photo_storage_url: uploadItem.serverUrl
        });
      }
      // Note: Categories and containers don't have photo_storage_url property
      // Only items support photos in this implementation
    } catch (error) {
      console.error('[OfflineImageService] Erreur mise à jour entité avec URL serveur:', error);
    }
  }

  /**
   * Obtenir les statistiques des images
   */
  async getImageStats(): Promise<{
    totalImages: number;
    pendingUploads: number;
    failedUploads: number;
    totalSizeBytes: number;
    uploadedImages: number;
  }> {
    try {
      const allImages = await localDB.imagesBlob.toArray();
      const totalSizeBytes = allImages.reduce((total, img) => total + img.size, 0);
      
      const pendingUploads = this.uploadQueue.filter(item => 
        item.uploadStatus === 'pending'
      ).length;
      
      const failedUploads = this.uploadQueue.filter(item => 
        item.uploadStatus === 'failed'
      ).length;
      
      const uploadedImages = this.uploadQueue.filter(item => 
        item.uploadStatus === 'uploaded'
      ).length;
      
      return {
        totalImages: allImages.length,
        pendingUploads,
        failedUploads,
        uploadedImages,
        totalSizeBytes
      };
    } catch (error) {
      console.error('[OfflineImageService] Erreur récupération stats:', error);
      return {
        totalImages: 0,
        pendingUploads: 0,
        failedUploads: 0,
        uploadedImages: 0,
        totalSizeBytes: 0
      };
    }
  }

  /**
   * Nettoyer les images uploadées anciennes
   */
  async cleanupUploadedImages(daysToKeep: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      // Supprimer les blobs des images uploadées anciennes
      const deletedCount = await localDB.imagesBlob
        .where('uploadStatus')
        .equals('uploaded')
        .and(img => img.createdAt < cutoffDate)
        .delete();
      
      // Nettoyer la queue d'upload
      this.uploadQueue = this.uploadQueue.filter(item => 
        item.uploadStatus !== 'uploaded' || item.createdAt >= cutoffDate
      );
      await this.saveUploadQueue();
      
      console.log(`[OfflineImageService] ${deletedCount} images uploadées nettoyées`);
      return deletedCount;
    } catch (error) {
      console.error('[OfflineImageService] Erreur lors du nettoyage:', error);
      return 0;
    }
  }

  /**
   * Méthodes utilitaires privées
   */
  private async loadUploadQueue(): Promise<void> {
    try {
      const stored = localStorage.getItem('offline_image_upload_queue');
      if (stored) {
        this.uploadQueue = JSON.parse(stored).map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt)
        }));
      }
    } catch (error) {
      console.error('[OfflineImageService] Erreur chargement queue:', error);
      this.uploadQueue = [];
    }
  }

  private async saveUploadQueue(): Promise<void> {
    try {
      localStorage.setItem('offline_image_upload_queue', JSON.stringify(this.uploadQueue));
    } catch (error) {
      console.error('[OfflineImageService] Erreur sauvegarde queue:', error);
    }
  }

  private async isOnline(): Promise<boolean> {
    try {
      // Test simple de connectivité
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private startAutoUpload(): void {
    // Vérifier la queue toutes les 30 secondes
    setInterval(async () => {
      if (await this.isOnline() && !this.isProcessingQueue) {
        this.processUploadQueue();
      }
    }, 30000);
  }

  /**
   * Méthodes publiques pour la gestion
   */
  async retryFailedUploads(): Promise<void> {
    const failedUploads = this.uploadQueue.filter(item => item.uploadStatus === 'failed');
    
    for (const upload of failedUploads) {
      upload.uploadStatus = 'pending';
      upload.uploadAttempts = 0;
      upload.errorMessage = undefined;
    }
    
    await this.saveUploadQueue();
    
    if (await this.isOnline()) {
      this.processUploadQueue();
    }
  }

  async clearUploadQueue(): Promise<void> {
    this.uploadQueue = [];
    await this.saveUploadQueue();
  }

  getUploadQueue(): ImageUploadQueue[] {
    return [...this.uploadQueue];
  }
}

// Export de l'instance singleton
export const offlineImageService = OfflineImageService.getInstance();