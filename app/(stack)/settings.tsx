import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { useRefreshStore } from '../../src/store/refreshStore';
import { useAuth } from '../../src/contexts/AuthContext';
import { selectAllCategories } from '../../src/store/categorySlice';
import { useQueryClient } from '@tanstack/react-query';
import { handleError } from '../../src/utils/errorHandler';
import { theme } from '../../src/utils/theme';
import * as Sentry from '@sentry/react-native';
import { clearImageCache } from '../../src/utils/s3AuthClient';

const SettingsScreen = () => {
  const router = useRouter();
  // Store access for potentially triggering refreshes
  useRefreshStore();
  const categories = useSelector(selectAllCategories);
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const [clearingCache, setClearingCache] = useState(false);

  const handleLogout = useCallback(async () => {
    try {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'User initiated logout',
        level: 'info'
      });
      
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      handleError(error, 'Erreur lors de la déconnexion');
      Sentry.captureException(error, {
        tags: { action: 'logout' }
      });
    }
  }, [signOut, router]);

  const handleClearImageCache = useCallback(async () => {
    Alert.alert(
      'Vider le cache d\'images',
      'Êtes-vous sûr de vouloir vider le cache d\'images ? Cette opération peut aider à libérer de l\'espace de stockage mais entraînera un nouveau téléchargement des images lors de la prochaine utilisation.',
      [
        {
          text: 'Annuler',
          style: 'cancel'
        },
        {
          text: 'Vider le cache',
          style: 'destructive',
          onPress: async () => {
            try {
              setClearingCache(true);
              
              Sentry.addBreadcrumb({
                category: 'cache',
                message: 'User initiated image cache clearing',
                level: 'info'
              });
              
              await clearImageCache();
              
              // Invalider les requêtes qui concernent les images
              queryClient.invalidateQueries({ queryKey: ['items'] });
              
              Alert.alert(
                'Cache vidé',
                'Le cache d\'images a été vidé avec succès.'
              );
            } catch (error) {
              handleError(error, 'Erreur lors du nettoyage du cache d\'images');
              Sentry.captureException(error, {
                tags: { action: 'clear_image_cache' }
              });
            } finally {
              setClearingCache(false);
            }
          }
        }
      ]
    );
  }, [queryClient]);

  if (!categories) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.push('/(tabs)/stock')}
        >
          <MaterialIcons name="arrow-back-ios" size={18} color="#007AFF" />
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/(stack)/containers')}
      >
        <MaterialIcons name="inbox" size={24} color="#007AFF" />
        <Text style={styles.menuText}>Gérer les containers</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/(stack)/categories')}
      >
        <MaterialIcons name="category" size={24} color="#007AFF" />
        <Text style={styles.menuText}>Gérer les catégories</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/(stack)/labels')}
      >
        <MaterialIcons name="label" size={24} color="#007AFF" />
        <Text style={styles.menuText}>Générer des étiquettes</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/(stack)/multi-receipt')}
      >
        <MaterialIcons name="receipt" size={24} color="#007AFF" />
        <Text style={styles.menuText}>Facture multi-articles</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={handleClearImageCache}
        disabled={clearingCache}
      >
        <MaterialIcons name="cleaning-services" size={24} color="#FF9500" />
        <Text style={[styles.menuText, { color: clearingCache ? '#999' : '#FF9500' }]}>
          {clearingCache ? 'Nettoyage en cours...' : 'Vider le cache d\'images'}
        </Text>
        {clearingCache ? (
          <ActivityIndicator size="small" color="#FF9500" />
        ) : (
          <MaterialIcons name="chevron-right" size={24} color="#999" />
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, { marginTop: 20, borderTopWidth: 1, borderTopColor: '#e5e5e5' }]}
        onPress={handleLogout}
      >
        <MaterialIcons name="logout" size={24} color="#FF3B30" />
        <Text style={[styles.menuText, { color: '#FF3B30' }]}>Se déconnecter</Text>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topBar: {
    height: Platform.OS === 'ios' ? 44 : 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginTop: Platform.OS === 'ios' ? 47 : 0,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    marginLeft: -theme.spacing.sm,
  },
  backButtonText: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.primary,
    marginLeft: -4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  menuText: {
    flex: 1,
    marginLeft: theme.spacing.md,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.primary,
  },
  dangerItem: {
    marginTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.danger.background,
  },
  dangerText: {
    color: theme.colors.danger.text,
    fontWeight: '500',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.secondary,
  },
  topBarTitle: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: theme.colors.text.primary,
    flex: 1,
    textAlign: 'center',
    marginRight: theme.spacing.xl,
  },
});

export default SettingsScreen; 