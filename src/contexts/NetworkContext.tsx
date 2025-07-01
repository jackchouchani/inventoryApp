import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface NetworkContextType {
  isOnline: boolean;
  isInternetReachable: boolean;
  type: string;
  details: any;
  lastOnlineTime: Date | null;
  connectionLostTime: Date | null;
  pendingOperationsCount: number;
  offlineEvents: any[];
  isOfflineModeForced: boolean;
  setOfflineModeForced: (forced: boolean) => void;
  addOfflineEvent: (event: any) => void;
  removeOfflineEvent: (eventId: string) => void;
  clearOfflineEvents: () => void;
}

const OFFLINE_MODE_KEY = '@offline_mode_forced';

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const networkStatus = useNetworkStatus();
  const [lastOnlineTime, setLastOnlineTime] = useState<Date | null>(null);
  const [connectionLostTime, setConnectionLostTime] = useState<Date | null>(null);
  const [offlineEvents, setOfflineEvents] = useState<any[]>([]);
  const [isOfflineModeForced, setIsOfflineModeForced] = useState(false);

  // Charger le mode offline forcé depuis AsyncStorage
  useEffect(() => {
    const loadOfflineMode = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(OFFLINE_MODE_KEY);
        if (savedMode !== null) {
          setIsOfflineModeForced(JSON.parse(savedMode));
        }
      } catch (error) {
        console.warn('Erreur lors du chargement du mode offline:', error);
      }
    };
    loadOfflineMode();
  }, []);

  useEffect(() => {
    if (networkStatus.isOnline && networkStatus.isInternetReachable && !isOfflineModeForced) {
      setLastOnlineTime(new Date());
      setConnectionLostTime(null);
    } else if (!networkStatus.isOnline || !networkStatus.isInternetReachable || isOfflineModeForced) {
      if (!connectionLostTime) {
        setConnectionLostTime(new Date());
      }
    }
  }, [networkStatus.isOnline, networkStatus.isInternetReachable, isOfflineModeForced]);

  useEffect(() => {
    console.log('NetworkContext - isOfflineModeForced changed to:', isOfflineModeForced);
  }, [isOfflineModeForced]);

  const addOfflineEvent = (event: any) => {
    setOfflineEvents(prev => [...prev, event]);
  };

  const removeOfflineEvent = (eventId: string) => {
    setOfflineEvents(prev => prev.filter(event => event.id !== eventId));
  };

  const clearOfflineEvents = () => {
    setOfflineEvents([]);
  };

  const setOfflineModeForced = async (forced: boolean) => {
    console.log('setOfflineModeForced called with:', forced);
    console.log('Current isOfflineModeForced state:', isOfflineModeForced);
    try {
      await AsyncStorage.setItem(OFFLINE_MODE_KEY, JSON.stringify(forced));
      console.log('AsyncStorage updated successfully for offline mode');
      setIsOfflineModeForced(forced);
      console.log('setIsOfflineModeForced state update called with:', forced);
    } catch (error) {
      console.warn('Erreur lors de la sauvegarde du mode offline:', error);
    }
  };

  const contextValue: NetworkContextType = {
    isOnline: isOfflineModeForced ? false : networkStatus.isOnline,
    isInternetReachable: isOfflineModeForced ? false : networkStatus.isInternetReachable,
    type: networkStatus.type,
    details: networkStatus.details,
    lastOnlineTime,
    connectionLostTime,
    pendingOperationsCount: offlineEvents.length,
    offlineEvents,
    isOfflineModeForced,
    setOfflineModeForced,
    addOfflineEvent,
    removeOfflineEvent,
    clearOfflineEvents,
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

export default NetworkContext;