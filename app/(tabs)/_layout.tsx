import React from "react";
import { Tabs } from "expo-router";
import { TouchableOpacity, View, Platform, StyleSheet } from "react-native";
import 'material-icons/iconfont/material-icons.css';
import { useRouter } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { useAppTheme } from "../../src/contexts/ThemeContext";

export default function TabLayout() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeTheme } = useAppTheme();

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
              <span
                className="material-icons"
                style={{
                  fontSize: 22,
                  color: activeTheme.primary
                }}
              >
                qr_code_scanner
              </span>
            </TouchableOpacity>
            <View style={[styles.separator, { backgroundColor: `${activeTheme.primary}33` }]} />
            <TouchableOpacity
              onPress={() => router.push('/(stack)/stats')}
              style={styles.headerButton}
              activeOpacity={0.7}
            >
              <span
                className="material-icons"
                style={{
                  fontSize: 22,
                  color: activeTheme.primary
                }}
              >
                bar_chart
              </span>
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
              <span
                className="material-icons"
                style={{
                  fontSize: 22,
                  color: activeTheme.primary
                }}
              >
                settings
              </span>
            </TouchableOpacity>
          </View>
        ),
        headerStatusBarHeight: 0,
        tabBarStyle: {
          backgroundColor: activeTheme.surface,
          borderTopWidth: 1,
          borderTopColor: activeTheme.border,
          height: 65,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          paddingBottom: Platform.OS === 'ios' ? 45 : 0,
          paddingTop: 8,
        },
        tabBarActiveTintColor: activeTheme.primary,
        tabBarInactiveTintColor: activeTheme.text.secondary,
        tabBarLabelStyle: {
          fontSize: 13,
          paddingBottom: Platform.OS === 'ios' ? 8 : 0,
          fontWeight: '500',
        },
        tabBarItemStyle: {
          padding: 0,
          height: 65,
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
            <span
              className="material-icons"
              style={{
                fontSize: size,
                color: color
              }}
            >
              inventory
            </span>
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Ajouter",
          tabBarIcon: ({ color, size }) => (
            <span
              className="material-icons"
              style={{
                fontSize: size,
                color: color
              }}
            >
              add_circle_outline
            </span>
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scanner",
          tabBarIcon: ({ color, size }) => (
              <span
              className="material-icons"
              style={{
                fontSize: size,
                color: color
              }}
            >
              qr_code
            </span>
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