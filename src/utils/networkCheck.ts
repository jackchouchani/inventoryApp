import NetInfo from '@react-native-community/netinfo';

export const checkNetworkConnection = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  } catch (error) {
    console.error('Erreur lors de la vérification de la connexion réseau:', error);
    return false;
  }
};

export const subscribeToNetworkChanges = (
  callback: (isConnected: boolean) => void
) => {
  return NetInfo.addEventListener(state => {
    callback(state.isConnected ?? false);
  });
}; 