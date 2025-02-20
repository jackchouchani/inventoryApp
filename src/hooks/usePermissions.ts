import { useState, useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import * as Sentry from '@sentry/react-native';
import {
  checkCameraPermission,
  checkMediaLibraryPermission,
  checkPermission,
} from '../services/permissions';
import * as Permissions from 'expo-permissions';

const openSettings = () => {
  Linking.openSettings().catch((err) => {
    console.error('Impossible d\'ouvrir les paramètres:', err);
  });
};

export const usePermissions = () => {
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  const requestPermission = useCallback(async (type: 'camera' | 'mediaLibrary' | Permissions.PermissionType) => {
    try {
      let granted = false;

      switch (type) {
        case 'camera':
          granted = await checkCameraPermission();
          break;
        case 'mediaLibrary':
          granted = await checkMediaLibraryPermission();
          break;
        default:
          granted = await checkPermission(type as Permissions.PermissionType);
      }

      setHasPermission(granted);

      if (!granted) {
        Alert.alert(
          'Permission requise',
          `L'accès à ${type === 'camera' ? 'la caméra' : 'la galerie'} est nécessaire pour cette fonctionnalité.`,
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Paramètres', onPress: openSettings }
          ]
        );
      }

      return granted;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          context: 'permissions',
          permissionType: type,
        },
      });
      console.error('Erreur lors de la demande de permission:', error);
      return false;
    }
  }, []);

  return {
    hasPermission,
    requestPermission,
  };
}; 