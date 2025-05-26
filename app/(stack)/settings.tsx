import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, ActivityIndicator, Platform, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { useRefreshStore } from '../../src/store/refreshStore';
import { useAuth } from '../../src/contexts/AuthContext';
import { selectAllCategories } from '../../src/store/categorySlice';
import { useQueryClient } from '@tanstack/react-query';
import { handleError } from '../../src/utils/errorHandler';
import { useAppTheme, ThemeMode } from '../../src/contexts/ThemeContext';
import * as Sentry from '@sentry/react-native';
import { clearImageCache } from '../../src/utils/s3AuthClient';

const SettingsScreen = () => {
  const router = useRouter();
  const { activeTheme, themeMode, setThemeMode } = useAppTheme();
  const systemScheme = useColorScheme();
  const isSystemDark = systemScheme === 'dark';
  useRefreshStore();
  const categories = useSelector(selectAllCategories);
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const [clearingCache, setClearingCache] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!isLoggingOut) return;
    
    const timer = setTimeout(() => {
      router.replace('/(auth)/login');
      setIsLoggingOut(false);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isLoggingOut, router]);

  const handleLogout = useCallback(async () => {
    try {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'User initiated logout',
        level: 'info'
      });
      
      setIsLoggingOut(true);
      await signOut();
    } catch (error) {
      setIsLoggingOut(false);
      console.error('Erreur lors de la déconnexion:', error);
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de la déconnexion. Veuillez réessayer.'
      );
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
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: activeTheme.background }]}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
        <Text style={[styles.loadingText, { color: activeTheme.text.secondary }]}>Chargement...</Text>
      </View>
    );
  }

  let currentThemeDisplay: string;
  switch (themeMode) {
    case 'system':
      currentThemeDisplay = `Système (${isSystemDark ? 'Sombre' : 'Clair'})`;
      break;
    case 'dark':
      currentThemeDisplay = 'Sombre';
      break;
    case 'light':
      currentThemeDisplay = 'Clair';
      break;
    default:
      // This case should ideally not be reached if themeMode is correctly typed
      // as 'system' | 'dark' | 'light'.
      // The following line helps ensure exhaustiveness if ThemeMode type changes.
      currentThemeDisplay = 'Clair'; // Fallback, or consider throwing an error
      break;
  }

  return (
    <View style={[styles.container, { backgroundColor: activeTheme.background }]}>
      <View style={[styles.topBar, { backgroundColor: activeTheme.surface, borderBottomColor: activeTheme.border}]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.push('/(tabs)/stock')}
        >
          <MaterialIcons 
            name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} 
            size={24} 
            color={activeTheme.primary} 
            style={Platform.OS === 'ios' ? { marginRight: -2 } : {}}
          />
          {Platform.OS === 'ios' && (
            <Text style={[styles.backButtonText, { color: activeTheme.primary }]}>Retour</Text>
          )}
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: activeTheme.text.primary }]}>Paramètres</Text>
        <View style={{ width: Platform.OS === 'ios' ? 70 : 50 }} /> {/* Spacer to help center title */}
      </View>

      {/* Theme Selection Section */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: activeTheme.text.secondary }]}>Thème (Actuel: {currentThemeDisplay})</Text>
        <View style={[styles.themeButtonsContainer, { borderColor: activeTheme.border }]}>
          {(['light', 'dark', 'system'] as ThemeMode[]).map((modeOption) => (
            <TouchableOpacity
              key={modeOption}
              style={[
                styles.themeButton,
                { backgroundColor: themeMode === modeOption ? activeTheme.primary : activeTheme.surface },
                modeOption === 'light' ? styles.themeButtonLeft : {},
                modeOption === 'system' ? styles.themeButtonRight : {},
                modeOption !== 'system' ? { borderRightWidth: 1 } : {}
              ]}
              onPress={() => setThemeMode(modeOption)}
            >
              <Text style={[
                styles.themeButtonText,
                { color: themeMode === modeOption ? activeTheme.text.inverse : activeTheme.text.primary }
              ]}>
                {modeOption === 'light' ? 'Clair' : modeOption === 'dark' ? 'Sombre' : 'Système'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.menuItem, { backgroundColor: activeTheme.surface, borderBottomColor: activeTheme.border, borderTopColor: activeTheme.border}] }
        onPress={() => router.push('/(stack)/containers')}
      >
        <MaterialIcons name="inbox" size={24} color={activeTheme.primary} />
        <Text style={[styles.menuText, { color: activeTheme.text.primary }]}>Gérer les containers</Text>
        <MaterialIcons name="chevron-right" size={24} color={activeTheme.text.secondary} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, { backgroundColor: activeTheme.surface, borderBottomColor: activeTheme.border}] }
        onPress={() => router.push('/(stack)/categories')}
      >
        <MaterialIcons name="category" size={24} color={activeTheme.primary} />
        <Text style={[styles.menuText, { color: activeTheme.text.primary }]}>Gérer les catégories</Text>
        <MaterialIcons name="chevron-right" size={24} color={activeTheme.text.secondary} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, { backgroundColor: activeTheme.surface, borderBottomColor: activeTheme.border}] }
        onPress={() => router.push('/(stack)/labels')}
      >
        <MaterialIcons name="label" size={24} color={activeTheme.primary} />
        <Text style={[styles.menuText, { color: activeTheme.text.primary }]}>Générer des étiquettes</Text>
        <MaterialIcons name="chevron-right" size={24} color={activeTheme.text.secondary} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, { backgroundColor: activeTheme.surface, borderBottomColor: activeTheme.border}] }
        onPress={() => router.push('/(stack)/multi-receipt')}
      >
        <MaterialIcons name="receipt" size={24} color={activeTheme.primary} />
        <Text style={[styles.menuText, { color: activeTheme.text.primary }]}>Facture multi-articles</Text>
        <MaterialIcons name="chevron-right" size={24} color={activeTheme.text.secondary} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, { backgroundColor: activeTheme.surface, borderBottomColor: activeTheme.border}] }
        onPress={handleClearImageCache}
        disabled={clearingCache}
      >
        <MaterialIcons name="cleaning-services" size={24} color={activeTheme.warning} />
        <Text style={[styles.menuText, { color: clearingCache ? activeTheme.text.disabled : activeTheme.warning }]}>
          {clearingCache ? 'Nettoyage en cours...' : 'Vider le cache d\'images'}
        </Text>
        {clearingCache ? (
          <ActivityIndicator size="small" color={activeTheme.warning} />
        ) : (
          <MaterialIcons name="chevron-right" size={24} color={activeTheme.text.secondary} />
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, { backgroundColor: activeTheme.surface, borderBottomColor: activeTheme.border, borderTopColor: activeTheme.border, marginTop: 20 }]} 
        onPress={handleLogout}
      >
        <MaterialIcons name="logout" size={24} color={activeTheme.danger.main} />
        <Text style={[styles.menuText, { color: activeTheme.danger.main }]}>Se déconnecter</Text>
        <MaterialIcons name="chevron-right" size={24} color={activeTheme.text.secondary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor will be set by activeTheme
  },
  topBar: {
    height: Platform.OS === 'ios' ? 44 : 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    // backgroundColor and borderBottomColor will be set by activeTheme
    borderBottomWidth: 1,
    marginTop: Platform.OS === 'ios' ? 47 : 0,
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 0,
    minWidth: Platform.OS === 'ios' ? 70 : 50,
    justifyContent: 'flex-start',
  },
  backButtonText: {
    fontSize: 17,
    // color will be set by activeTheme
    marginLeft: Platform.OS === 'ios' ? 6 : 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    // backgroundColor and borderBottomColor will be set by activeTheme
  },
  menuText: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    // color will be set by activeTheme
  },
  dangerItem: {
    marginTop: 24,
    borderTopWidth: 1,
    // borderTopColor: theme.colors.border,
    // backgroundColor: theme.colors.danger.background,
  },
  dangerText: {
    // color: theme.colors.danger.text,
    fontWeight: '500',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    // color will be set by activeTheme
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: Platform.OS === 'ios' ? '600' : '500',
    // color will be set by activeTheme
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  sectionContainer: {
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    // color will be set by activeTheme
  },
  themeButtonsContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    // borderColor will be set by activeTheme
  },
  themeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor will be set by activeTheme and selection state
    borderRightWidth: 1,
    // borderRightColor will be set by activeTheme.colors.border
  },
  themeButtonLeft: {
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7,
  },
  themeButtonRight: {
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
    borderRightWidth: 0,
  },
  themeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    // color will be set by activeTheme and selection state
  },
});

export default SettingsScreen;