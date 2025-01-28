import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useDispatch } from 'react-redux';
import { createBackup, restoreBackup } from '../utils/backupManager';
import { getItems, getCategories, getContainers, resetDatabase } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';

const BackupScreen = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useDispatch();
  const triggerRefresh = useRefreshStore(state => state.triggerRefresh);

  useEffect(() => {
    checkSharingAvailability();
  }, []);

  const checkSharingAvailability = async () => {
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (!isSharingAvailable) {
      setError('Sharing is not available on this device');
    }
  };

  const handleCreateBackup = async () => {
    try {
      setIsLoading(true);
      
      // Vérifier si le partage est disponible
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Erreur', 'Le partage n\'est pas disponible sur cet appareil');
        return;
      }

      // Créer la sauvegarde
      const backupPath = await createBackup();
      
      // Vérifier que le fichier existe
      const fileInfo = await FileSystem.getInfoAsync(backupPath);
      if (!fileInfo.exists) {
        throw new Error('Le fichier de sauvegarde n\'a pas été créé');
      }

      // Partager le fichier
      await Sharing.shareAsync(backupPath, {
        mimeType: 'application/zip',
        dialogTitle: 'Sauvegarder la base de données',
        UTI: 'public.zip-archive' // pour iOS
      });

    } catch (error: any) {
      console.error('Erreur lors de la création de la sauvegarde:', error);
      Alert.alert(
        'Erreur',
        'Impossible de créer ou partager la sauvegarde: ' + error.message
      );
    } finally {
      setIsLoading(false);
    }
  };

  const reloadAppData = async () => {
    try {
      const [items, categories, containers] = await Promise.all([
        getItems(),
        getCategories(),
        getContainers()
      ]);

      // Dispatch actions to update Redux store
      dispatch({ type: 'items/setItems', payload: items });
      dispatch({ type: 'categories/setCategories', payload: categories });
      dispatch({ type: 'containers/setContainers', payload: containers });
    } catch (err) {
      console.error('Failed to reload app data:', err);
      throw new Error('Failed to reload app data');
    }
  };

  const handleRestoreBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync();
      if (result.canceled) return;

      await restoreBackup(result.assets[0].uri);

      // Recharger toutes les données
      const [containers, categories, items] = await Promise.all([
        getContainers(),
        getCategories(),
        getItems()
      ]);

      // Mettre à jour le store Redux
      dispatch({ type: 'containers/setContainers', payload: containers });
      dispatch({ type: 'categories/setCategories', payload: categories });
      dispatch({ type: 'items/setItems', payload: items });

      triggerRefresh();
      Alert.alert('Succès', 'Sauvegarde restaurée avec succès');
    } catch (error: any) {
      console.error('Erreur lors de la restauration:', error);
      Alert.alert('Erreur', 'Impossible de restaurer la sauvegarde: ' + error.message);
    }
  };

  const handleResetDatabase = async () => {
    Alert.alert(
      'Réinitialiser la base de données',
      'Êtes-vous sûr de vouloir réinitialiser la base de données ? Toutes les données seront perdues.',
      [
        {
          text: 'Annuler',
          style: 'cancel'
        },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetDatabase();
              dispatch({ type: 'categories/setCategories', payload: [] });
              dispatch({ type: 'containers/setContainers', payload: [] });
              dispatch({ type: 'items/setItems', payload: [] });
              Alert.alert('Succès', 'Base de données réinitialisée avec succès');
            } catch (error) {
              console.error('Erreur lors de la réinitialisation:', error);
              Alert.alert('Erreur', 'Impossible de réinitialiser la base de données');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.backupButton]}
          onPress={handleCreateBackup}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Backup</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.restoreButton]}
          onPress={handleRestoreBackup}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Restore from Backup</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.resetButton}
        onPress={handleResetDatabase}
      >
        <Text style={styles.resetButtonText}>Réinitialiser la base de données</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  backupButton: {
    backgroundColor: '#007AFF',
  },
  restoreButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },
  resetButton: {
    backgroundColor: '#ff4444',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default BackupScreen;