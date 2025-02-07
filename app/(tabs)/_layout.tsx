import React from "react";
import { Tabs } from "expo-router";
import { TouchableOpacity, View } from "react-native";
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from "expo-router";

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarStyle: { 
          height: 88, 
          paddingTop: 8,
          paddingBottom: 32,
          backgroundColor: '#fff',
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 10,
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        headerStyle: {
          backgroundColor: '#f5f5f5',
          borderBottomWidth: 0,
          shadowColor: 'transparent',
        },
        headerTitleStyle: {
          fontSize: 17,
          fontWeight: '600',
        },
        headerRight: () => (
          <View style={{ flexDirection: 'row', marginRight: 8 }}>
            <TouchableOpacity 
              onPress={() => router.push('/(stack)/stats')}
              style={{ 
                padding: 8,
                marginRight: 4,
              }}
            >
              <MaterialIcons name="bar-chart" size={24} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => router.push('/(stack)/settings')}
              style={{ 
                padding: 8,
                marginRight: 4,
              }}
            >
              <MaterialIcons name="settings" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="stock"
        options={{
          title: "Stock",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scanner",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="add"
        options={{
          title: "Ajouter",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}