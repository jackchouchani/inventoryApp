import { useState, useRef, useCallback } from 'react';
import { Container } from '../types/container';
import { Item } from '../types/item';

// Types pour la machine à états
export type ScanMode = 'container' | 'items';

export interface ScannedItem extends Item {
  scannedAt: number;
}

export type ScannerState = 
  | { status: 'initializing' }
  | { status: 'ready'; mode: ScanMode }
  | { status: 'permission-needed'; message: string }
  | { status: 'container_confirmation'; container: Container }
  | { status: 'scanning_items'; container: Container; items: ScannedItem[] }
  | { status: 'processing'; container: Container; items: ScannedItem[]; progress: number }
  | { status: 'success'; container: Container; items: ScannedItem[] }
  | { status: 'error'; message: string };

export const useScannerStateMachine = () => {
  const [scannerState, setScannerState] = useState<ScannerState>({ status: 'initializing' });
  const scannerStateRef = useRef<ScannerState>({ status: 'initializing' });

  // Fonction pour mettre à jour l'état de manière synchrone
  const updateScannerState = useCallback((newState: ScannerState | ((prev: ScannerState) => ScannerState)) => {
    if (typeof newState === 'function') {
      const updatedState = newState(scannerStateRef.current);
      console.log(`Mise à jour de l'état (fonction): ${scannerStateRef.current.status} -> ${updatedState.status}`);
      scannerStateRef.current = updatedState;
      setScannerState(updatedState);
    } else {
      console.log(`Mise à jour de l'état: ${scannerStateRef.current.status} -> ${newState.status}`);
      scannerStateRef.current = newState;
      setScannerState(newState);
    }
  }, []);

  // Actions de la machine à états
  const goToReady = useCallback(() => {
    updateScannerState({ status: 'ready', mode: 'container' });
  }, [updateScannerState]);

  const goToPermissionNeeded = useCallback((message: string) => {
    updateScannerState({ status: 'permission-needed', message });
  }, [updateScannerState]);

  const goToContainerConfirmation = useCallback((container: Container) => {
    updateScannerState({ status: 'container_confirmation', container });
  }, [updateScannerState]);

  const goToScanningItems = useCallback((container: Container) => {
    updateScannerState({ status: 'scanning_items', container, items: [] });
  }, [updateScannerState]);

  const addScannedItem = useCallback((item: Item) => {
    updateScannerState((prev) => {
      if (prev.status !== 'scanning_items') return prev;
      
      // Vérifier si l'item est déjà scanné
      const isAlreadyScanned = prev.items.some(scannedItem => scannedItem.id === item.id);
      if (isAlreadyScanned) return prev;

      return {
        ...prev,
        items: [{ ...item, scannedAt: Date.now() }, ...prev.items]
      };
    });
  }, [updateScannerState]);

  const removeScannedItem = useCallback((itemId: number) => {
    updateScannerState((prev) => {
      if (prev.status !== 'scanning_items') return prev;
      
      return {
        ...prev,
        items: prev.items.filter(item => item.id !== itemId)
      };
    });
  }, [updateScannerState]);

  const goToProcessing = useCallback(() => {
    updateScannerState((prev) => {
      if (prev.status !== 'scanning_items') return prev;
      
      return {
        status: 'processing',
        container: prev.container,
        items: prev.items,
        progress: 0
      };
    });
  }, [updateScannerState]);

  const updateProgress = useCallback((progress: number) => {
    updateScannerState((prev) => {
      if (prev.status !== 'processing') return prev;
      
      return { ...prev, progress };
    });
  }, [updateScannerState]);

  const goToSuccess = useCallback(() => {
    updateScannerState((prev) => {
      if (prev.status !== 'processing') return prev;
      
      return {
        status: 'success',
        container: prev.container,
        items: prev.items
      };
    });
  }, [updateScannerState]);

  const goToError = useCallback((message: string) => {
    updateScannerState({ status: 'error', message });
  }, [updateScannerState]);

  const reset = useCallback(() => {
    updateScannerState({ status: 'ready', mode: 'container' });
  }, [updateScannerState]);

  return {
    scannerState,
    scannerStateRef,
    actions: {
      goToReady,
      goToPermissionNeeded,
      goToContainerConfirmation,
      goToScanningItems,
      addScannedItem,
      removeScannedItem,
      goToProcessing,
      updateProgress,
      goToSuccess,
      goToError,
      reset,
      updateScannerState // Pour les cas d'usage avancés
    }
  };
}; 