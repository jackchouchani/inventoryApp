import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';

interface UpdateNotificationProps {
  onUpdateAvailable?: (newVersion: string) => void;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ 
  onUpdateAvailable 
}) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState<string>('');
  const [currentVersion, setCurrentVersion] = useState<string>('');

  useEffect(() => {
    // Service Worker désactivé pour éviter les problèmes de reload
    console.log('[UpdateNotification] Service Worker désactivé');
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('[App] Service Worker enregistré:', registration);

      // Vérifier s'il y a une mise à jour en attente
      if (registration.waiting) {
        showUpdatePrompt();
      }

      // Écouter les nouvelles installations
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdatePrompt();
            }
          });
        }
      });

    } catch (error) {
      console.error('[App] Erreur lors de l\'enregistrement du Service Worker:', error);
    }
  };

  const setupUpdateListener = () => {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, currentVersion: current, newVersion: newer, version } = event.data;

      switch (type) {
        case 'UPDATE_AVAILABLE':
          console.log('[App] Mise à jour disponible:', current, '->', newer);
          setCurrentVersion(current);
          setNewVersion(newer);
          setUpdateAvailable(true);
          onUpdateAvailable?.(newer);
          break;

        case 'SW_UPDATED':
          console.log('[App] Service Worker mis à jour vers la version:', version);
          // Optionnel : afficher une notification de succès
          break;

        default:
          break;
      }
    });
  };

  const showUpdatePrompt = () => {
    if (typeof window !== 'undefined') {
      Alert.alert(
        'Mise à jour disponible',
        `Une nouvelle version de l'application est disponible. Voulez-vous la télécharger maintenant ?`,
        [
          {
            text: 'Plus tard',
            style: 'cancel',
          },
          {
            text: 'Mettre à jour',
            onPress: applyUpdate,
          },
        ]
      );
    }
  };

  const applyUpdate = () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Envoyer un message au service worker pour forcer la mise à jour
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      
      // Recharger la page après un court délai
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };
  
  // Interface web pour les notifications
  if (typeof window !== 'undefined' && updateAvailable) {
    return (
      <View style={styles.container}>
        <View style={styles.notification}>
          <Text style={styles.title}>Mise à jour disponible</Text>
          <Text style={styles.message}>
            Version {newVersion} disponible (actuelle: {currentVersion})
          </Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.laterButton]} 
              onPress={() => setUpdateAvailable(false)}
            >
              <Text style={styles.laterButtonText}>Plus tard</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.updateButton]} 
              onPress={applyUpdate}
            >
              <Text style={styles.updateButtonText}>Mettre à jour</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  notification: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    marginHorizontal: 5,
  },
  laterButton: {
    backgroundColor: '#f0f0f0',
  },
  updateButton: {
    backgroundColor: '#007AFF',
  },
  laterButtonText: {
    textAlign: 'center',
    color: '#666',
    fontWeight: '500',
  },
  updateButtonText: {
    textAlign: 'center',
    color: 'white',
    fontWeight: '500',
  },
});

export default UpdateNotification; 