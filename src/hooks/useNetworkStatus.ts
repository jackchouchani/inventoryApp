import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkStatus {
  isOnline: boolean;
  isInternetReachable: boolean;
  type: string;
  details: any;
  isConnected: boolean; // Deprecated, keep for backward compatibility
}

export const useNetworkStatus = (): NetworkStatus => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: true,
    isInternetReachable: true,
    type: 'unknown',
    details: null,
    isConnected: true,
  });

  useEffect(() => {
    // Get initial network state
    NetInfo.fetch().then(state => {
      updateNetworkStatus(state);
    });

    // Listen for network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      updateNetworkStatus(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const updateNetworkStatus = (state: NetInfoState) => {
    const isOnline = state.isConnected ?? false;
    const isInternetReachable = state.isInternetReachable ?? false;
    
    setNetworkStatus({
      isOnline,
      isInternetReachable,
      type: state.type || 'unknown',
      details: state.details,
      isConnected: isOnline, // For backward compatibility
    });
  };

  return networkStatus;
}; 