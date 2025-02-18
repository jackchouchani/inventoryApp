import React from "react";
import { Tabs } from "expo-router";
import { TouchableOpacity, View, Platform } from "react-native";
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { ProtectedRoute } from '../../src/components/ProtectedRoute';

export default function TabLayout() {
  const router = useRouter();

  return (
    <ProtectedRoute>
      <Tabs
          screenOptions={{
            headerShown: true,
            headerTitle: "Comptoir Vintage",
            headerTitleStyle: {
              fontSize: 20,
              fontWeight: '700',
            },
            headerTitleAlign: 'center',
            headerStyle: {
              backgroundColor: '#f5f5f5',
              height: 60,
            },
            headerStatusBarHeight: 0,
            tabBarStyle: {
              backgroundColor: '#fff',
              borderTopWidth: 1,
              borderTopColor: '#e5e5e5',
              height: 65,
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              paddingBottom: Platform.OS === 'ios' ? 45 : 0,
              paddingTop: 8,
            },
            tabBarActiveTintColor: '#007AFF',
            tabBarInactiveTintColor: '#8E8E93',
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
              backgroundColor: '#f5f5f5',
            },
            headerRight: () => (
              <View style={{ flexDirection: 'row', marginRight: 15 }}>
                <TouchableOpacity
                  onPress={() => router.push('/(stack)/stats')}
                  style={{ marginRight: 15 }}
                >
                  <MaterialIcons name="bar-chart" size={24} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/(stack)/settings')}
                >
                  <MaterialIcons name="settings" size={24} color="#007AFF" />
                </TouchableOpacity>
              </View>
            ),
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="inventory" size={size} color={color} />
            ),
          }}
        />
        
        <Tabs.Screen
          name="scan"
          options={{
            title: "Scanner",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="qr-code-scanner" size={size} color={color} />
            ),
          }}
        />
        
        <Tabs.Screen
          name="add"
          options={{
            title: "Ajouter",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="add-circle-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </ProtectedRoute>
  );
}