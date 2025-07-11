import React, { useEffect } from "react";
import { Tabs } from "expo-router";
import { TouchableOpacity, View, Platform, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/contexts/AuthContext";
import { useAppTheme } from "../../src/contexts/ThemeContext";
import Icon from "../../src/components/Icon";

export default function TabLayout() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeTheme } = useAppTheme();
  const insets = useSafeAreaInsets();


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
        headerLeft: () => (
          <View style={[styles.headerButtonsContainer, { backgroundColor: `${activeTheme.primary}15` }]}>
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
            <View style={[styles.separator, { backgroundColor: `${activeTheme.primary}33` }]} />
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
        headerStatusBarHeight: 0,
        tabBarStyle: {
          backgroundColor: activeTheme.surface,
          borderTopWidth: 1,
          borderTopColor: activeTheme.border,
          height: Platform.OS === 'ios' ? 65 + insets.bottom + 20 : 65,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom + 10 : 0,
          paddingTop: Platform.OS === 'ios' ? 12 : 0,
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
          padding: 0,
          height: Platform.OS === 'ios' ? 65 + insets.bottom + 20 : 65,
          paddingBottom: Platform.OS === 'ios' ? 100 : 0,
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
            <Icon name="add_circle_outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scanner",
          tabBarIcon: ({ color, size }) => (
            <Icon name="qr_code" size={size} color={color} />
          ),
        }}
      />
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
  },
  headerButtonsContainer: {
    flexDirection: 'row',
    // backgroundColor sera défini par le thème
    borderRadius: 20,
    padding: 4,
    marginLeft: 15,
  },
  headerButton: {
    padding: 8,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 36,
  },
  separator: {
    width: 1,
    height: 20,
    // backgroundColor sera défini par le thème
    marginVertical: 2,
  },
});