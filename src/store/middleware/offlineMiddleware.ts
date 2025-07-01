import { Middleware } from '@reduxjs/toolkit';
import { OfflineEventQueue } from '../../services/OfflineEventQueue';
import { localDB, OfflineEvent } from '../../database/localDatabase';
import { EventType, EntityType } from '../../types/offline';
import { v4 as uuidv4 } from 'uuid';

// Utilitaire pour générer un device ID unique
const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = `device_${uuidv4()}`;
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

// Mapping des actions vers les types d'événements
const actionToEventTypeMap: Record<string, EventType> = {
  // Items
  'items/createItem/pending': 'CREATE',
  'items/updateItem/pending': 'UPDATE',
  'items/deleteItem/pending': 'DELETE',
  
  // Categories
  'categories/createCategory/pending': 'CREATE',
  'categories/updateCategory/pending': 'UPDATE',
  'categories/deleteCategory/pending': 'DELETE',
  
  // Containers
  'containers/createContainer/pending': 'CREATE',
  'containers/updateContainer/pending': 'UPDATE',
  'containers/deleteContainer/pending': 'DELETE',
};

// Mapping des actions vers les entités
const actionToEntityMap: Record<string, EntityType> = {
  // Items
  'items/createItem/pending': 'item',
  'items/updateItem/pending': 'item',
  'items/deleteItem/pending': 'item',
  
  // Categories
  'categories/createCategory/pending': 'category',
  'categories/updateCategory/pending': 'category',
  'categories/deleteCategory/pending': 'category',
  
  // Containers
  'containers/createContainer/pending': 'container',
  'containers/updateContainer/pending': 'container',
  'containers/deleteContainer/pending': 'container',
};

interface OfflineAction {
  type: string;
  payload: any;
  meta: {
    arg: any;
    requestId: string;
    requestStatus: 'pending' | 'fulfilled' | 'rejected';
    offline?: boolean;
    skipOffline?: boolean;
  };
}

export const offlineMiddleware: Middleware = 
  (_storeAPI) => (next) => async (action: any) => {
    
    // Vérifier si c'est une action de mutation qui nous intéresse
    const actionType = action.type;
    const eventType = actionToEventTypeMap[actionType];
    const entityType = actionToEntityMap[actionType];
    
    // Si ce n'est pas une action trackée ou si elle a le flag skipOffline, passer
    if (!eventType || !entityType || action.meta?.skipOffline) {
      return next(action);
    }

    // Récupérer l'état réseau
    let isOffline = false;
    try {
      // Note: En pratique, on devrait avoir accès à l'état réseau via le store
      // ou un autre mécanisme. Ici on va vérifier différemment.
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        signal: AbortSignal.timeout(1000)
      });
      isOffline = !response.ok;
    } catch {
      isOffline = true;
    }

    // Si en ligne, laisser l'action continuer normalement
    if (!isOffline) {
      return next(action);
    }

    console.log('[OfflineMiddleware] Mode offline détecté, création d\'un événement offline:', {
      actionType,
      eventType,
      entityType,
      payload: action.payload
    });

    // Créer un événement offline
    const offlineEvent: OfflineEvent = {
      id: uuidv4(),
      type: eventType,
      entity: entityType,
      entityId: extractEntityId(action, eventType),
      data: action.meta.arg,
      originalData: await extractOriginalData(action, eventType, entityType),
      timestamp: new Date(),
      userId: await getCurrentUserId(),
      deviceId: getDeviceId(),
      status: 'pending',
      syncAttempts: 0,
      metadata: extractMetadata(action)
    };

    try {
      // Sauvegarder l'événement dans IndexedDB
      await localDB.offlineEvents.add(offlineEvent);
      
      // Ajouter à la queue de synchronisation
      const eventQueue = OfflineEventQueue.getInstance();
      await eventQueue.enqueue(offlineEvent);

      console.log('[OfflineMiddleware] Événement offline créé avec succès:', offlineEvent.id);
      
      // Modifier l'action pour indiquer qu'elle est offline
      const modifiedAction = {
        ...action,
        meta: {
          ...action.meta,
          offline: true,
          offlineEventId: offlineEvent.id
        }
      };

      // Programmer une synchronisation en arrière-plan si disponible
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          // Note: background sync might not be available
          if ('sync' in registration) {
            return (registration as any).sync.register('sync-data');
          }
        });
      }

      return next(modifiedAction);
      
    } catch (error) {
      console.error('[OfflineMiddleware] Erreur lors de la création de l\'événement offline:', error);
      
      // En cas d'erreur, laisser l'action continuer avec un flag d'erreur
      const errorAction = {
        ...action,
        meta: {
          ...action.meta,
          offlineError: (error as Error).message
        }
      };
      
      return next(errorAction);
    }
  };

// Utilitaires
function extractEntityId(action: OfflineAction, eventType: EventType): string | number {
  const arg = action.meta.arg;
  
  if (eventType === 'CREATE') {
    // Pour les créations, on va générer un ID temporaire
    return `offline_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
  
  // Pour les autres opérations, utiliser l'ID fourni
  return arg.id || arg.itemId || arg.categoryId || arg.containerId || 'unknown';
}

async function extractOriginalData(
  action: OfflineAction, 
  eventType: EventType, 
  entityType: EntityType
): Promise<any> {
  if (eventType === 'CREATE') {
    return null; // Pas de données originales pour les créations
  }
  
  const entityId = action.meta.arg.id || action.meta.arg.itemId || action.meta.arg.categoryId || action.meta.arg.containerId;
  
  if (!entityId) return null;
  
  try {
    // Récupérer les données actuelles de l'entité depuis IndexedDB
    let originalData = null;
    
    switch (entityType) {
      case 'item':
        originalData = await localDB.items.get(entityId);
        break;
      case 'category':
        originalData = await localDB.categories.get(entityId);
        break;
      case 'container':
        originalData = await localDB.containers.get(entityId);
        break;
    }
    
    return originalData || null;
  } catch (error) {
    console.error('[OfflineMiddleware] Erreur lors de la récupération des données originales:', error);
    return null;
  }
}

function extractMetadata(action: OfflineAction): any {
  const arg = action.meta.arg;
  const metadata: any = {};
  
  // Extraire les informations importantes selon le type d'action
  if (arg.qrCode) {
    metadata.qrCode = arg.qrCode;
  }
  
  if (arg.containerId) {
    metadata.parentEntityId = arg.containerId;
  }
  
  if (arg.categoryId) {
    metadata.parentEntityId = arg.categoryId;
  }
  
  if (arg.photo_storage_url) {
    metadata.tempImageUrls = [arg.photo_storage_url];
  }
  
  return metadata;
}

async function getCurrentUserId(): Promise<string | undefined> {
  // Récupérer l'ID utilisateur depuis le contexte d'auth ou le localStorage
  try {
    const userSession = localStorage.getItem('supabase.auth.token');
    if (userSession) {
      const session = JSON.parse(userSession);
      return session.user?.id;
    }
  } catch (error) {
    console.error('[OfflineMiddleware] Erreur lors de la récupération de l\'userId:', error);
  }
  return undefined;
}