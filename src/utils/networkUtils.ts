import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { errorHandler } from './errorHandler';

/**
 * Vérifie l'état de la connexion réseau
 * @returns Promise<boolean> - true si connecté, false sinon
 */
export const checkNetworkConnection = async (): Promise<boolean> => {
  try {
    // Vérification via NetInfo
    const state = await NetInfo.fetch();
    const isConnected = state.isConnected ?? false;

    // Si connecté, vérifier l'accès à Internet
    if (isConnected) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        clearTimeout(timeout);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  } catch (error) {
    errorHandler.handleError(error, {
      context: 'networkUtils.checkNetworkConnection',
      severity: 'warning',
    });
    return false;
  }
};

/**
 * S'abonne aux changements d'état du réseau
 * @param callback - Fonction appelée lors des changements d'état
 * @returns Fonction de désabonnement
 */
export const subscribeToNetworkChanges = (
  callback: (state: NetInfoState) => void
): NetInfoSubscription => {
  return NetInfo.addEventListener(state => {
    callback(state);
  });
};

/**
 * Hook personnalisé pour la gestion de l'état du réseau
 * @param onConnectionChange - Callback optionnel pour les changements d'état
 * @returns Object contenant l'état actuel du réseau
 */
export const getNetworkDetails = async (): Promise<{
  isConnected: boolean;
  type: string;
  isInternetReachable: boolean;
  details: NetInfoState['details'];
}> => {
  try {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected ?? false,
      type: state.type,
      isInternetReachable: state.isInternetReachable ?? false,
      details: state.details,
    };
  } catch (error) {
    errorHandler.handleError(error, {
      context: 'networkUtils.getNetworkDetails',
      severity: 'warning',
    });
    return {
      isConnected: false,
      type: 'unknown',
      isInternetReachable: false,
      details: null,
    };
  }
}; 