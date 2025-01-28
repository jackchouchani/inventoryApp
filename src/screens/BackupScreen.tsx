import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useDispatch } from 'react-redux';
import { createBackup, restoreBackup } from '../utils/backupManager';
import { getItems, getCategories, getContainers } from '../database/database';

const BackupScreen = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useDispatch();

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
    setIsLoading(true);
    setError(null);
    try {
      const backupPath = await createBackup();
      
      // Ensure the backup file exists
      const fileInfo = await FileSystem.getInfoAsync(backupPath);
      if (!fileInfo.exists) {
        throw new Error('Backup file was not created successfully');
      }

      // Share the backup file
      await Sharing.shareAsync(backupPath, {
        mimeType: 'application/zip',
        dialogTitle: 'Save your backup file'
      });

      Alert.alert(
        'Backup Created',
        'Backup has been created and shared successfully',
        [{ text: 'OK' }]
      );
    } catch (err) {
      console.error('Backup creation failed:', err);
      setError('Failed to create or share backup. Please try again.');
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
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/zip',
        copyToCacheDirectory: true
      });

      if (result.assets && result.assets.length > 0) {
        setIsLoading(true);
        setError(null);
        try {
          await restoreBackup(result.assets[0].uri);
          await reloadAppData(); // Reload all data after restore
          
          Alert.alert(
            'Backup Restored',
            'Your backup has been restored successfully.',
            [{ text: 'OK' }]
          );
        } catch (err) {
          console.error('Backup restoration failed:', err);
          setError('Failed to restore backup. Please try again.');
        } finally {
          setIsLoading(false);
        }
      }
    } catch (err) {
      console.error('Document picking failed:', err);
      setError('Failed to select backup file. Please try again.');
    }
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
});

export default BackupScreen;