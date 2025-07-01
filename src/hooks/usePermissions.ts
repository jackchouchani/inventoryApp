import { useState, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Camera } from 'expo-camera';

export interface PermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}

export interface Permissions {
  camera: PermissionStatus;
  mediaLibrary: PermissionStatus;
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<Permissions>({
    camera: { granted: false, canAskAgain: true, status: 'undetermined' },
    mediaLibrary: { granted: false, canAskAgain: true, status: 'undetermined' }
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = async () => {
    setIsLoading(true);
    try {
      const [cameraStatus, mediaLibraryStatus] = await Promise.all([
        Camera.getCameraPermissionsAsync(),
        MediaLibrary.getPermissionsAsync()
      ]);

      setPermissions({
        camera: {
          granted: cameraStatus.granted,
          canAskAgain: cameraStatus.canAskAgain,
          status: cameraStatus.status
        },
        mediaLibrary: {
          granted: mediaLibraryStatus.granted,
          canAskAgain: mediaLibraryStatus.canAskAgain,
          status: mediaLibraryStatus.status
        }
      });
    } catch (error) {
      console.error('Error checking permissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      const result = await Camera.requestCameraPermissionsAsync();
      
      setPermissions(prev => ({
        ...prev,
        camera: {
          granted: result.granted,
          canAskAgain: result.canAskAgain,
          status: result.status
        }
      }));

      if (!result.granted && !result.canAskAgain) {
        Alert.alert(
          'Permission requise',
          'L\'accès à la caméra est nécessaire pour scanner les codes QR. Veuillez l\'activer dans les paramètres de l\'application.',
          [{ text: 'OK' }]
        );
      }

      return result.granted;
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      return false;
    }
  };

  const requestMediaLibraryPermission = async (): Promise<boolean> => {
    try {
      const result = await MediaLibrary.requestPermissionsAsync();
      
      setPermissions(prev => ({
        ...prev,
        mediaLibrary: {
          granted: result.granted,
          canAskAgain: result.canAskAgain,
          status: result.status
        }
      }));

      if (!result.granted && !result.canAskAgain) {
        Alert.alert(
          'Permission requise',
          'L\'accès à la galerie est nécessaire pour sauvegarder les photos. Veuillez l\'activer dans les paramètres de l\'application.',
          [{ text: 'OK' }]
        );
      }

      return result.granted;
    } catch (error) {
      console.error('Error requesting media library permission:', error);
      return false;
    }
  };

  const requestAllPermissions = async (): Promise<Permissions> => {
    const [cameraGranted, mediaLibraryGranted] = await Promise.all([
      requestCameraPermission(),
      requestMediaLibraryPermission()
    ]);

    return {
      camera: { ...permissions.camera, granted: cameraGranted },
      mediaLibrary: { ...permissions.mediaLibrary, granted: mediaLibraryGranted }
    };
  };

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Alert.alert(
        'Permissions requises',
        'Veuillez activer les permissions dans Réglages > Confidentialité',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Permissions requises',
        'Veuillez activer les permissions dans les paramètres de l\'application',
        [{ text: 'OK' }]
      );
    }
  };

  return {
    permissions,
    isLoading,
    requestCameraPermission,
    requestMediaLibraryPermission,
    requestAllPermissions,
    checkAllPermissions,
    openSettings
  };
}