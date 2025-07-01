import { useState, useCallback } from 'react';
import { useOfflineQRSearch } from './useOfflineSearch';
import { useNetwork } from '../contexts/NetworkContext';
import { localDB } from '../database/localDatabase';
import { OfflineEventQueue } from '../services/OfflineEventQueue';
import { offlineIdManager } from '../utils/offlineIdManager';
import { v4 as uuidv4 } from 'uuid';

export type ScanMode = 'container' | 'items';

export interface ScanResult {
  success: boolean;
  message: string;
  type?: 'container' | 'item';
  data?: any;
  offline?: boolean;
}

interface ScannedItem {
  id: number | string;
  name: string;
  qrCode: string;
  containerId?: number | string;
  scannedAt: number;
  isOffline?: boolean;
}

interface ScannerState {
  mode: ScanMode;
  selectedContainer: any | null;
  scannedItems: ScannedItem[];
  isProcessing: boolean;
  stats: {
    totalScanned: number;
    newItems: number;
    existingItems: number;
    offlineActions: number;
  };
}

export function useOfflineScannerWorkflow() {
  const [state, setState] = useState<ScannerState>({
    mode: 'container',
    selectedContainer: null,
    scannedItems: [],
    isProcessing: false,
    stats: {
      totalScanned: 0,
      newItems: 0,
      existingItems: 0,
      offlineActions: 0
    }
  });

  const { findByQRCode, isLoading: isSearching } = useOfflineQRSearch();
  const { isOnline } = useNetwork();
  const eventQueue = OfflineEventQueue.getInstance();

  /**
   * Gérer un scan de QR Code
   */
  const handleScan = useCallback(async (scannedData: string): Promise<ScanResult> => {
    console.log('[OfflineScannerWorkflow] Scan QR Code:', scannedData, 'Mode:', state.mode);

    try {
      if (state.mode === 'container') {
        return await handleContainerScan(scannedData);
      } else {
        return await handleItemScan(scannedData);
      }
    } catch (error) {
      console.error('[OfflineScannerWorkflow] Erreur lors du scan:', error);
      return {
        success: false,
        message: `Erreur lors du scan: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        offline: !isOnline
      };
    }
  }, [state.mode, isOnline]);

  /**
   * Gérer le scan d'un container
   */
  const handleContainerScan = useCallback(async (qrCode: string): Promise<ScanResult> => {
    const searchResult = await findByQRCode(qrCode, 'container');

    if (searchResult.found && searchResult.data) {
      const container = searchResult.data;
      
      setState(prev => ({
        ...prev,
        mode: 'items',
        selectedContainer: container,
        scannedItems: [],
        stats: { ...prev.stats }
      }));

      // Charger les items existants du container
      await loadContainerItems(container.id);

      return {
        success: true,
        message: `Container "${container.name}" sélectionné. Vous pouvez maintenant scanner les articles.`,
        type: 'container',
        data: container,
        offline: searchResult.fromCache
      };
    } else {
      // Container non trouvé - proposer de créer
      return {
        success: false,
        message: `Container non trouvé (QR: ${qrCode}). Voulez-vous créer un nouveau container ?`,
        type: 'container',
        offline: !isOnline
      };
    }
  }, [findByQRCode, isOnline]);

  /**
   * Gérer le scan d'un item
   */
  const handleItemScan = useCallback(async (qrCode: string): Promise<ScanResult> => {
    if (!state.selectedContainer) {
      return {
        success: false,
        message: 'Aucun container sélectionné. Scannez d\'abord un container.',
        offline: !isOnline
      };
    }

    const searchResult = await findByQRCode(qrCode, 'item');

    if (searchResult.found && searchResult.data) {
      const item = searchResult.data;

      // Vérifier si l'item est déjà scanné
      const alreadyScanned = state.scannedItems.find(si => si.id === item.id);
      if (alreadyScanned) {
        return {
          success: false,
          message: `Article "${item.name}" déjà scanné dans ce container.`,
          type: 'item',
          data: item,
          offline: searchResult.fromCache
        };
      }

      // Ajouter l'item à la liste des scannés
      const scannedItem: ScannedItem = {
        id: item.id,
        name: item.name,
        qrCode: item.qrCode,
        containerId: item.containerId,
        scannedAt: Date.now(),
        isOffline: searchResult.fromCache
      };

      setState(prev => ({
        ...prev,
        scannedItems: [...prev.scannedItems, scannedItem],
        stats: {
          ...prev.stats,
          totalScanned: prev.stats.totalScanned + 1,
          existingItems: prev.stats.existingItems + 1
        }
      }));

      return {
        success: true,
        message: `Article "${item.name}" ajouté au container.`,
        type: 'item',
        data: item,
        offline: searchResult.fromCache
      };
    } else {
      // Item non trouvé - proposer de créer
      return await handleNewItemScan(qrCode);
    }
  }, [findByQRCode, state.selectedContainer, state.scannedItems, isOnline]);

  /**
   * Gérer le scan d'un nouvel item (non trouvé)
   */
  const handleNewItemScan = useCallback(async (qrCode: string): Promise<ScanResult> => {
    if (!state.selectedContainer) {
      return {
        success: false,
        message: 'Aucun container sélectionné.',
        offline: !isOnline
      };
    }

    // Créer un nouvel item temporaire
    const tempItemId = offlineIdManager.generateOfflineId('item');
    const newItem = {
      id: tempItemId,
      name: `Nouvel article ${qrCode}`,
      description: 'Article créé via scanner offline',
      qrCode,
      purchasePrice: 0,
      sellingPrice: 0,
      status: 'available' as const,
      containerId: state.selectedContainer.id,
      categoryId: undefined,
      locationId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isOffline: true
    };

    try {
      // Sauvegarder dans IndexedDB
      await localDB.items.add({
        ...newItem,
        lastSyncedAt: new Date(),
        syncStatus: 'pending'
      });

      // Créer un événement offline pour la synchronisation
      const offlineEvent = {
        id: uuidv4(),
        type: 'CREATE' as const,
        entity: 'item' as const,
        entityId: tempItemId,
        data: newItem,
        timestamp: new Date(),
        userId: undefined, // TODO: Récupérer depuis le contexte auth
        deviceId: 'device_' + Date.now(),
        status: 'pending' as const,
        syncAttempts: 0,
        metadata: {
          qrCode,
          createdViaScanner: true
        }
      };

      await eventQueue.enqueue(offlineEvent);

      // Ajouter à la liste des scannés
      const scannedItem: ScannedItem = {
        id: tempItemId,
        name: newItem.name,
        qrCode,
        containerId: state.selectedContainer.id,
        scannedAt: Date.now(),
        isOffline: true
      };

      setState(prev => ({
        ...prev,
        scannedItems: [...prev.scannedItems, scannedItem],
        stats: {
          ...prev.stats,
          totalScanned: prev.stats.totalScanned + 1,
          newItems: prev.stats.newItems + 1,
          offlineActions: prev.stats.offlineActions + 1
        }
      }));

      return {
        success: true,
        message: `Nouvel article créé et ajouté au container "${state.selectedContainer.name}".`,
        type: 'item',
        data: newItem,
        offline: true
      };

    } catch (error) {
      console.error('[OfflineScannerWorkflow] Erreur création item:', error);
      return {
        success: false,
        message: `Erreur lors de la création de l'article: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        offline: !isOnline
      };
    }
  }, [state.selectedContainer, isOnline, eventQueue]);

  /**
   * Charger les items existants du container
   */
  const loadContainerItems = useCallback(async (containerId: number | string) => {
    try {
      const existingItems = await localDB.items
        .where('containerId')
        .equals(containerId)
        .toArray();

      const scannedItems = existingItems.map(item => ({
        id: item.id,
        name: item.name,
        qrCode: item.qrCode || '',
        containerId: item.containerId ?? undefined,
        scannedAt: Date.now() - 1000, // Marquer comme déjà présent
        isOffline: item.isOffline || false
      }));

      setState(prev => ({
        ...prev,
        scannedItems
      }));

      console.log(`[OfflineScannerWorkflow] ${existingItems.length} items chargés pour le container ${containerId}`);
    } catch (error) {
      console.error('[OfflineScannerWorkflow] Erreur chargement items container:', error);
    }
  }, []);

  /**
   * Finaliser le scan - déplacer tous les items scannés vers le container
   */
  const finalizeScan = useCallback(async (): Promise<{
    success: boolean;
    message: string;
    movedItems: number;
    offlineActions: number;
  }> => {
    if (!state.selectedContainer || state.scannedItems.length === 0) {
      return {
        success: false,
        message: 'Aucun item à traiter.',
        movedItems: 0,
        offlineActions: 0
      };
    }

    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      let movedItems = 0;
      let offlineActions = 0;

      for (const scannedItem of state.scannedItems) {
        // Si l'item n'était pas déjà dans ce container, le déplacer
        if (scannedItem.containerId !== state.selectedContainer.id) {
          await moveItemToContainer(scannedItem.id, state.selectedContainer.id);
          movedItems++;
          
          if (!isOnline) {
            offlineActions++;
          }
        }
      }

      setState(prev => ({
        ...prev,
        isProcessing: false,
        stats: {
          ...prev.stats,
          offlineActions: prev.stats.offlineActions + offlineActions
        }
      }));

      return {
        success: true,
        message: `${movedItems} article(s) déplacé(s) vers "${state.selectedContainer.name}".`,
        movedItems,
        offlineActions
      };

    } catch (error) {
      setState(prev => ({ ...prev, isProcessing: false }));
      console.error('[OfflineScannerWorkflow] Erreur finalisation:', error);
      
      return {
        success: false,
        message: `Erreur lors de la finalisation: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        movedItems: 0,
        offlineActions: 0
      };
    }
  }, [state.selectedContainer, state.scannedItems, isOnline]);

  /**
   * Déplacer un item vers un container
   */
  const moveItemToContainer = useCallback(async (
    itemId: number | string, 
    containerId: number | string | null
  ) => {
    try {
      // Mettre à jour dans IndexedDB
      await localDB.items.update(itemId, {
        containerId: typeof containerId === 'string' ? parseInt(containerId) : containerId,
        updatedAt: new Date().toISOString(),
        localModifiedAt: new Date(),
        syncStatus: 'pending'
      });

      // Créer un événement offline si nécessaire
      if (!isOnline) {
        const offlineEvent = {
          id: uuidv4(),
          type: 'MOVE' as const,
          entity: 'item' as const,
          entityId: itemId,
          data: { containerId },
          originalData: await localDB.items.get(itemId),
          timestamp: new Date(),
          userId: undefined, // TODO: Récupérer depuis le contexte auth
          deviceId: 'device_' + Date.now(),
          status: 'pending' as const,
          syncAttempts: 0,
          metadata: {
            parentEntityId: containerId || undefined
          }
        };

        await eventQueue.enqueue(offlineEvent);
      }

      console.log(`[OfflineScannerWorkflow] Item ${itemId} déplacé vers container ${containerId}`);
    } catch (error) {
      console.error('[OfflineScannerWorkflow] Erreur déplacement item:', error);
      throw error;
    }
  }, [isOnline, eventQueue]);

  /**
   * Créer un nouveau container
   */
  const createNewContainer = useCallback(async (
    qrCode: string,
    name: string,
    description?: string
  ): Promise<ScanResult> => {
    try {
      const tempContainerId = offlineIdManager.generateOfflineId('container');
      
      // Générer un numéro de container unique
      const existingNumbers = await localDB.containers.orderBy('number').keys();
      const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers as number[]) : 0;
      const newNumber = maxNumber + 1;

      const newContainer = {
        id: tempContainerId,
        name,
        description: description || '',
        number: newNumber,
        qrCode,
        locationId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOffline: true
      };

      // Sauvegarder dans IndexedDB
      await localDB.containers.add({
        ...newContainer,
        lastSyncedAt: new Date(),
        syncStatus: 'pending'
      });

      // Créer un événement offline
      const offlineEvent = {
        id: uuidv4(),
        type: 'CREATE' as const,
        entity: 'container' as const,
        entityId: tempContainerId,
        data: newContainer,
        timestamp: new Date(),
        userId: undefined, // TODO: Récupérer depuis le contexte auth
        deviceId: 'device_' + Date.now(),
        status: 'pending' as const,
        syncAttempts: 0,
        metadata: {
          qrCode,
          createdViaScanner: true
        }
      };

      await eventQueue.enqueue(offlineEvent);

      // Sélectionner le nouveau container
      setState(prev => ({
        ...prev,
        mode: 'items',
        selectedContainer: newContainer,
        scannedItems: [],
        stats: {
          ...prev.stats,
          offlineActions: prev.stats.offlineActions + 1
        }
      }));

      return {
        success: true,
        message: `Nouveau container "${name}" créé et sélectionné.`,
        type: 'container',
        data: newContainer,
        offline: true
      };

    } catch (error) {
      console.error('[OfflineScannerWorkflow] Erreur création container:', error);
      return {
        success: false,
        message: `Erreur lors de la création du container: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        offline: !isOnline
      };
    }
  }, [isOnline, eventQueue]);

  /**
   * Vider le container (retirer tous les items)
   */
  const clearContainer = useCallback(async (): Promise<{
    success: boolean;
    message: string;
    clearedItems: number;
  }> => {
    if (!state.selectedContainer) {
      return {
        success: false,
        message: 'Aucun container sélectionné.',
        clearedItems: 0
      };
    }

    try {
      const itemsToMove = await localDB.items
        .where('containerId')
        .equals(state.selectedContainer.id)
        .toArray();

      for (const item of itemsToMove) {
        await moveItemToContainer(item.id, null); // null = aucun container
      }

      setState(prev => ({
        ...prev,
        scannedItems: [],
        stats: {
          ...prev.stats,
          offlineActions: prev.stats.offlineActions + itemsToMove.length
        }
      }));

      return {
        success: true,
        message: `${itemsToMove.length} article(s) retiré(s) du container.`,
        clearedItems: itemsToMove.length
      };

    } catch (error) {
      console.error('[OfflineScannerWorkflow] Erreur vidage container:', error);
      return {
        success: false,
        message: `Erreur lors du vidage: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        clearedItems: 0
      };
    }
  }, [state.selectedContainer, moveItemToContainer]);

  /**
   * Réinitialiser le workflow
   */
  const reset = useCallback(() => {
    setState({
      mode: 'container',
      selectedContainer: null,
      scannedItems: [],
      isProcessing: false,
      stats: {
        totalScanned: 0,
        newItems: 0,
        existingItems: 0,
        offlineActions: 0
      }
    });
  }, []);

  /**
   * Changer de mode
   */
  const setMode = useCallback((mode: ScanMode) => {
    setState(prev => ({ ...prev, mode }));
  }, []);

  return {
    // État
    mode: state.mode,
    selectedContainer: state.selectedContainer,
    scannedItems: state.scannedItems,
    isProcessing: state.isProcessing,
    stats: state.stats,
    isSearching,
    isOnline,

    // Actions
    handleScan,
    finalizeScan,
    createNewContainer,
    clearContainer,
    reset,
    setMode,

    // Utilitaires
    loadContainerItems,
    moveItemToContainer
  };
}