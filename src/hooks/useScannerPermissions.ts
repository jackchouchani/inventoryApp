import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkCameraPermissionPWA, requestCameraPermissionPWA, getCameraInstructionsPWA } from '../utils/pwaPermissions';

const CAMERA_PERMISSION_KEY = '@app:camera_permission';

export interface PermissionStatus {
  granted: boolean;
  denied: boolean;
  needsRequest: boolean;
  isLoading: boolean;
  error?: string;
  instructions?: string;
}

export const useScannerPermissions = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [hasCheckedPermission, setHasCheckedPermission] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({
    granted: false,
    denied: false,
    needsRequest: false,
    isLoading: true
  });

  // Vérification initiale des permissions
  const checkPermissions = useCallback(async () => {
    try {
      console.log("Vérification des permissions de caméra...");
      
      if (Platform.OS === 'web') {
        console.log("Plateforme web/PWA détectée");
        
        const pwaPermissionStatus = await checkCameraPermissionPWA();
        console.log("Statut permissions PWA:", pwaPermissionStatus);
        
        if (pwaPermissionStatus.denied) {
          setPermissionStatus({
            granted: false,
            denied: true,
            needsRequest: false,
            isLoading: false,
            error: 'Permission caméra refusée',
            instructions: getCameraInstructionsPWA()
          });
          return;
        }
        
        if (pwaPermissionStatus.prompt && pwaPermissionStatus.isPWA) {
          setPermissionStatus({
            granted: false,
            denied: false,
            needsRequest: true,
            isLoading: false
          });
          return;
        }
        
        // Permission accordée ou browser standard
        setPermissionStatus({
          granted: true,
          denied: false,
          needsRequest: false,
          isLoading: false
        });
        return;
      }
      
      // Logique mobile
      if (permission?.granted) {
        console.log("Permission de caméra déjà accordée");
        setPermissionStatus({
          granted: true,
          denied: false,
          needsRequest: false,
          isLoading: false
        });
        return;
      }

      const storedPermission = await AsyncStorage.getItem(CAMERA_PERMISSION_KEY);
      console.log(`Permission stockée: ${storedPermission}`);
      
      if (storedPermission === 'granted' && !permission?.granted) {
        console.log("Permission stockée mais pas active, demande de renouvellement");
        const result = await requestPermission();
        if (result.granted) {
          console.log("Permission renouvelée avec succès");
          await AsyncStorage.setItem(CAMERA_PERMISSION_KEY, 'granted');
          setPermissionStatus({
            granted: true,
            denied: false,
            needsRequest: false,
            isLoading: false
          });
        } else {
          console.log("Permission refusée lors du renouvellement");
          await AsyncStorage.removeItem(CAMERA_PERMISSION_KEY);
          setPermissionStatus({
            granted: false,
            denied: true,
            needsRequest: false,
            isLoading: false
          });
        }
      } else {
        console.log("Aucune permission stockée, en attente de demande utilisateur");
        setPermissionStatus({
          granted: false,
          denied: false,
          needsRequest: true,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des permissions:', error);
      
      // En cas d'erreur sur web, on procède quand même
      if (Platform.OS === 'web') {
        setPermissionStatus({
          granted: true,
          denied: false,
          needsRequest: false,
          isLoading: false
        });
      } else {
        setPermissionStatus({
          granted: false,
          denied: false,
          needsRequest: true,
          isLoading: false,
          error: 'Erreur lors de la vérification des permissions'
        });
      }
    }
  }, [permission?.granted, requestPermission]);

  // Demander la permission
  const handleRequestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setPermissionStatus(prev => ({ ...prev, isLoading: true }));

      if (Platform.OS === 'web') {
        console.log("Demande de permission caméra pour PWA");
        const granted = await requestCameraPermissionPWA();
        
        if (granted) {
          console.log("Permission PWA accordée");
          setPermissionStatus({
            granted: true,
            denied: false,
            needsRequest: false,
            isLoading: false
          });
          return true;
        } else {
          console.log("Permission PWA refusée");
          setPermissionStatus({
            granted: false,
            denied: true,
            needsRequest: false,
            isLoading: false,
            error: 'Permission caméra refusée',
            instructions: getCameraInstructionsPWA()
          });
          return false;
        }
      }
      
      // Logique mobile
      console.log("Demande de permission de caméra mobile");
      const result = await requestPermission();
      if (result.granted) {
        console.log("Permission mobile accordée");
        await AsyncStorage.setItem(CAMERA_PERMISSION_KEY, 'granted');
        setPermissionStatus({
          granted: true,
          denied: false,
          needsRequest: false,
          isLoading: false
        });
        return true;
      } else {
        console.log("Permission mobile refusée");
        setPermissionStatus({
          granted: false,
          denied: true,
          needsRequest: false,
          isLoading: false,
          error: 'Permission de caméra refusée. Veuillez autoriser l\'accès à la caméra dans les paramètres de votre appareil.'
        });
        return false;
      }
    } catch (error) {
      console.error('Erreur lors de la demande de permission:', error);
      setPermissionStatus({
        granted: false,
        denied: false,
        needsRequest: true,
        isLoading: false,
        error: 'Erreur lors de la demande de permission de caméra.'
      });
      return false;
    }
  }, [requestPermission]);

  // Réinitialiser les permissions
  const resetPermissions = useCallback(async () => {
    if (Platform.OS !== 'web') {
      await AsyncStorage.removeItem(CAMERA_PERMISSION_KEY);
    }
    setHasCheckedPermission(false);
    setPermissionStatus({
      granted: false,
      denied: false,
      needsRequest: false,
      isLoading: true
    });
  }, []);

  // Vérifier les permissions au montage
  useEffect(() => {
    if (!hasCheckedPermission) {
      setHasCheckedPermission(true);
      checkPermissions();
    }
  }, [hasCheckedPermission, checkPermissions]);

  return {
    permissionStatus,
    requestPermission: handleRequestPermission,
    resetPermissions,
    recheckPermissions: checkPermissions,
    
    // Helpers pour faciliter l'utilisation
    isGranted: permissionStatus.granted,
    isDenied: permissionStatus.denied,
    needsRequest: permissionStatus.needsRequest,
    isLoading: permissionStatus.isLoading,
    error: permissionStatus.error,
    instructions: permissionStatus.instructions
  };
}; 