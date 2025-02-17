import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, View, Text, Platform, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function StackLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#f8f9fa',
        },
        headerTintColor: '#007AFF',
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 17,
        },
        animation: 'slide_from_bottom',
        headerBackTitle: "Retour",
        contentStyle: {
          backgroundColor: '#f8f9fa',
        },
        headerShown: true,
        headerBackVisible: true,
        headerShadowVisible: false,
        headerTitleAlign: 'center',
        ...Platform.select({
          ios: {
            headerTopInsetEnabled: false,
            headerTransparent: false,
            headerLargeTitle: false,
            headerStatusBarHeight: 0,
            contentStyle: {
              paddingTop: 0,
            },
            headerStyle: {
              backgroundColor: '#f8f9fa',
              height: 44,
            },
          }
        })
      }}
    >
      <Stack.Screen 
        name="settings" 
        options={{ 
          headerTitle: () => (
            <View style={styles.headerTitleContainer}>
              <MaterialIcons name="settings" size={20} color="#007AFF" style={styles.headerIcon} />
              <Text style={styles.headerText}>Paramètres</Text>
            </View>
          ),
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/stock')}
              style={styles.headerButton}
            >
              <MaterialIcons name="arrow-back" size={20} color="#007AFF" />
            </TouchableOpacity>
          ),
        }} 
      />
      <Stack.Screen 
        name="stats" 
        options={{ 
          headerTitle: () => (
            <View style={styles.headerTitleContainer}>
              <MaterialIcons name="bar-chart" size={22} color="#007AFF" style={styles.headerIcon} />
              <Text style={styles.headerText}>Statistiques</Text>
            </View>
          ),
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/stock')}
              style={styles.headerButton}
            >
              <MaterialIcons name="arrow-back" size={22} color="#007AFF" />
            </TouchableOpacity>
          ),
        }} 
      />
      <Stack.Screen 
        name="labels" 
        options={{ 
          headerTitle: () => (
            <View style={styles.headerTitleContainer}>
              <MaterialIcons name="label" size={22} color="#007AFF" style={styles.headerIcon} />
              <Text style={styles.headerText}>Étiquettes</Text>
            </View>
          ),
        }} 
      />
      <Stack.Screen 
        name="backup" 
        options={{ 
          headerTitle: () => (
            <View style={styles.headerTitleContainer}>
              <MaterialIcons name="backup" size={22} color="#007AFF" style={styles.headerIcon} />
              <Text style={styles.headerText}>Sauvegarde</Text>
            </View>
          ),
        }} 
      />
      <Stack.Screen 
        name="containers" 
        options={{ 
          headerTitle: () => (
            <View style={styles.headerTitleContainer}>
              <MaterialIcons name="inbox" size={22} color="#007AFF" style={styles.headerIcon} />
              <Text style={styles.headerText}>Containers</Text>
            </View>
          ),
        }} 
      />
      <Stack.Screen 
        name="categories" 
        options={{ 
          headerTitle: () => (
            <View style={styles.headerTitleContainer}>
              <MaterialIcons name="category" size={22} color="#007AFF" style={styles.headerIcon} />
              <Text style={styles.headerText}>Catégories</Text>
            </View>
          ),
        }} 
      />
      <Stack.Screen 
        name="add-category" 
        options={{ 
          headerTitle: () => (
            <View style={styles.headerTitleContainer}>
              <MaterialIcons name="add-circle-outline" size={22} color="#007AFF" style={styles.headerIcon} />
              <Text style={styles.headerText}>Nouvelle catégorie</Text>
            </View>
          ),
        }} 
      />
      <Stack.Screen 
        name="edit-category" 
        options={{ 
          headerTitle: () => (
            <View style={styles.headerTitleContainer}>
              <MaterialIcons name="edit" size={22} color="#007AFF" style={styles.headerIcon} />
              <Text style={styles.headerText}>Modifier la catégorie</Text>
            </View>
          ),
        }} 
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    maxHeight: 44,
  },
  headerIcon: {
    marginRight: 4,
  },
  headerText: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 44,
  },
  headerButton: {
    padding: 8,
    marginLeft: -4,
    justifyContent: 'center',
    height: 44,
    maxHeight: 44,
  },
}); 