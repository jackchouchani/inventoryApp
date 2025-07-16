import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/components';
import { useAppTheme } from '../../src/contexts/ThemeContext';
import { useUnresolvedConflictsCount } from '../../src/hooks/useConflicts';
import { useUserPermissions } from '../../src/hooks/useUserPermissions';
import { Platform, StyleSheet, View, TouchableOpacity } from 'react-native';
import StyleFactory from '../../src/styles/StyleFactory';
import { useAuth } from '../../src/contexts/AuthContext';

export default function TabLayout() {
  const { activeTheme } = useAppTheme();
  const { count: conflictsCount } = useUnresolvedConflictsCount();
  const userPermissions = useUserPermissions();
  // const styles = StyleFactory.getThemedStyles(activeTheme, 'TabLayout');
  const { user } = useAuth();
  const router = useRouter();


  // Si l'utilisateur n'est pas authentifié, ne pas rendre les onglets
  // La redirection sera gérée par le layout racine
  if (!user) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitle: 'Comptoir Vintage',
        headerTitleStyle: [styles.headerTitle, { color: activeTheme.text.primary }],
        headerTitleAlign: 'center',
        headerStyle: {
          height: 60,
          backgroundColor: activeTheme.surface,
        },
        headerLeftContainerStyle: {
          alignItems: 'center',
          justifyContent: 'center',
          height: 60,
        },
        headerRightContainerStyle: {
          alignItems: 'center',
          justifyContent: 'center',
          height: 60,
        },
        headerLeft: () => (
          <View style={[styles.headerButtonsContainer, { backgroundColor: `${activeTheme.primary}15` }]}>
            {userPermissions.canUseScanner && (
              <TouchableOpacity
                onPress={() => router.push('/(stack)/scanner-info')}
                style={styles.headerButton}
                activeOpacity={0.7}
              >
                <Icon 
                  name="qr_code_scanner" 
                  size={22} 
                  color={activeTheme.primary} 
                />
              </TouchableOpacity>
            )}
            {userPermissions.canUseScanner && userPermissions.canViewDashboard && (
              <View style={[styles.separator, { backgroundColor: `${activeTheme.primary}33` }]} />
            )}
            {userPermissions.canViewDashboard && (
              <TouchableOpacity
                onPress={() => router.push('/(stack)/stats')}
                style={styles.headerButton}
                activeOpacity={0.7}
              >
                <Icon 
                  name="bar_chart" 
                  size={22} 
                  color={activeTheme.primary} 
                />
              </TouchableOpacity>
            )}
          </View>
        ),
        headerRight: () => (
          <View style={styles.rightButtonContainer}>
            <TouchableOpacity
              onPress={() => router.push('/(stack)/settings')}
              style={styles.headerButton}
              activeOpacity={0.7}
            >
              <Icon 
                name="settings" 
                size={22} 
                color={activeTheme.primary} 
              />
            </TouchableOpacity>
          </View>
        ),
        // Laisser React Navigation gérer automatiquement la hauteur de la status bar
        tabBarStyle: {
          backgroundColor: activeTheme.surface,
          borderTopWidth: 1,
          borderTopColor: activeTheme.border,
          // Laisser React Navigation gérer la hauteur automatiquement
        },
        tabBarActiveTintColor: activeTheme.primary,
        tabBarInactiveTintColor: activeTheme.text.secondary,
        tabBarLabelStyle: {
          fontSize: 13,
          paddingBottom: Platform.OS === 'ios' ? 2 : 0,
          fontWeight: '500',
          marginBottom: Platform.OS === 'ios' ? -2 : 0,
          marginTop: Platform.OS === 'ios' ? -4 : 0,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
      }}
    >
      <Tabs.Screen
        name="stock"
        options={{
          title: "Stock",
          headerStyle: {
            backgroundColor: activeTheme.background,
          },
          tabBarIcon: ({ color, size }: { color: string, size: number }) => (
            <Icon name="inventory" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Ajouter",
          tabBarIcon: ({ color, size }) => (
            <Icon 
              name="add_circle_outline" 
              size={size} 
              color={userPermissions.canCreateItems ? color : activeTheme.text.disabled} 
            />
          ),
          tabBarLabelStyle: {
            fontSize: 13,
            paddingBottom: Platform.OS === 'ios' ? 2 : 0,
            fontWeight: '500',
            marginBottom: Platform.OS === 'ios' ? -2 : 0,
            marginTop: Platform.OS === 'ios' ? -4 : 0,
            color: userPermissions.canCreateItems ? undefined : activeTheme.text.disabled,
          },
        }}
        listeners={{
          tabPress: (e) => {
            if (!userPermissions.canCreateItems) {
              e.preventDefault();
              // Optionnel: afficher un message d'information
            }
          },
        }}
      />
      {userPermissions.canUseScanner && (
        <Tabs.Screen
          name="scan"
          options={{
            title: "Scanner",
            tabBarIcon: ({ color, size }) => (
              <Icon name="qr_code" size={size} color={color} />
            ),
          }}
        />
      )}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    // color sera défini par le thème
  },
  rightButtonContainer: {
    marginRight: 15,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44, // Hauteur spécifique pour centrer dans le header
  },
  headerButtonsContainer: {
    flexDirection: 'row',
    // backgroundColor sera défini par le thème
    borderRadius: 20,
    padding: 4,
    marginLeft: 15,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44, // Hauteur spécifique pour centrer dans le header
  },
  headerButton: {
    padding: 8, // Padding uniforme
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 36, // Zone de touch standard
    minHeight: 36,
  },
  separator: {
    width: 1,
    height: 20,
    // backgroundColor sera défini par le thème
    marginVertical: 2,
  },
});