import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { supabase } from '../../src/config/supabase';
import { getItems, getCategories, getContainers, resetDatabase } from '../../src/database/database';
import { useRefreshStore } from '../../src/store/refreshStore';

const BackupScreen = () => {
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();
  const triggerRefresh = useRefreshStore(state => state.triggerRefresh);

  const handleResetDatabase = async () => {
    const isWeb = Platform.OS === 'web';
    
    const handleReset = async () => {
      try {
        setIsLoading(true);
        
        await resetDatabase();
        
        dispatch({ type: 'items/setItems', payload: [] });
        dispatch({ type: 'categories/setCategories', payload: [] });
        dispatch({ type: 'containers/setContainers', payload: [] });
        
        triggerRefresh();
        isWeb ? alert('Base de données réinitialisée avec succès') : 
                Alert.alert('Succès', 'Base de données réinitialisée avec succès');
      } catch (error) {
        console.error('Erreur détaillée:', error);
        isWeb ? alert('Impossible de réinitialiser la base de données') :
                Alert.alert('Erreur', 'Impossible de réinitialiser la base de données');
      } finally {
        setIsLoading(false);
      }
    };

    if (isWeb) {
      if (confirm('Êtes-vous sûr de vouloir réinitialiser la base de données ? Toutes les données seront perdues.')) {
        handleReset();
      }
    } else {
      Alert.alert(
        'Réinitialiser la base de données',
        'Êtes-vous sûr de vouloir réinitialiser la base de données ? Toutes les données seront perdues.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Réinitialiser', style: 'destructive', onPress: handleReset }
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.resetButton}
        onPress={handleResetDatabase}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.resetButtonText}>Réinitialiser la base de données</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  resetButton: {
    backgroundColor: '#ff4444',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center'
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});

export default BackupScreen;