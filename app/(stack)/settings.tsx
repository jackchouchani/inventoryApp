import React, { useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Text, Alert, ActivityIndicator, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../src/styles/StyleFactory';

import { Icon, CommonHeader } from '../../src/components';
import { useAuth } from '../../src/contexts/AuthContext';
import { selectAllCategories } from '../../src/store/categorySlice';
import { useAppTheme, ThemeMode } from '../../src/contexts/ThemeContext';
import * as Sentry from '@sentry/react-native';

const SettingsScreen = () => {
  const router = useRouter();
  const { activeTheme, themeMode, setThemeMode } = useAppTheme();
  const systemScheme = useColorScheme();
  const isSystemDark = systemScheme === 'dark';
  const categories = useSelector(selectAllCategories);
  const { signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'Settings');

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

  if (!categories) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
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
      currentThemeDisplay = 'Clair'; // Fallback
      break;
  }

  return (
    <View style={styles.container}>
      {/* ✅ COMMONHEADER - Header standardisé */}
      <CommonHeader 
        title="Paramètres"
        onBackPress={() => router.back()}
      />

      {/* Theme Selection Section */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Thème (Actuel: {currentThemeDisplay})</Text>
        <View style={styles.themeButtonsContainer}>
          {(['light', 'dark', 'system'] as ThemeMode[]).map((modeOption) => (
            <TouchableOpacity
              key={modeOption}
              style={[
                styles.themeButton,
                { backgroundColor: themeMode === modeOption ? activeTheme.primary : activeTheme.surface },
                modeOption === 'light' ? styles.themeButtonLeft : {},
                modeOption === 'system' ? styles.themeButtonRight : {},
                modeOption !== 'system' ? { borderRightWidth: 1, borderRightColor: activeTheme.border } : {}
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
        style={[styles.menuItem, { borderTopColor: activeTheme.border, borderTopWidth: 1 }]}
        onPress={() => router.push('/container')}
      >
        <Icon name="inbox" size={24} color={activeTheme.primary} />
        <Text style={styles.menuText}>Gérer les containers</Text>
        <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/category')}
      >
        <Icon name="category" size={24} color={activeTheme.primary} />
        <Text style={styles.menuText}>Gérer les catégories</Text>
        <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/location')}
      >
        <Icon name="location_on" size={24} color={activeTheme.primary} />
        <Text style={styles.menuText}>Gérer les emplacements</Text>
        <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/labels')}
      >
        <Icon name="label" size={24} color={activeTheme.primary} />
        <Text style={styles.menuText}>Générer des étiquettes</Text>
        <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/multi-receipt')}
      >
        <Icon name="receipt" size={24} color={activeTheme.primary} />
        <Text style={styles.menuText}>Facture multi-articles</Text>
        <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, styles.dangerItem]}
        onPress={handleLogout}
      >
        <Icon name="logout" size={24} color={activeTheme.danger.main} />
        <Text style={[styles.menuText, styles.dangerText]}>Se déconnecter</Text>
        <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
      </TouchableOpacity>
    </View>
  );
};

export default SettingsScreen;