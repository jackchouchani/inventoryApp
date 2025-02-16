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
          fontSize: Platform.OS === 'ios' ? 15 : 17,
        },
        presentation: 'modal',
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
            headerTitleContainerStyle: {
              paddingVertical: 4,
            },
            headerLeftContainerStyle: {
              paddingVertical: 4,
            },
            headerRightContainerStyle: {
              paddingVertical: 4,
            },
          }
        })
      }}
    >
      <Stack.Screen 
        name="settings" 
        options={{ 
          headerTitle: () => (
            <View style={[styles.headerTitleContainer, styles.iosHeaderFix]}>
              <MaterialIcons name="settings" size={20} color="#007AFF" style={styles.headerIcon} />
              <Text style={styles.headerText}>Paramètres</Text>
            </View>
          ),
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/stock')}
              style={[styles.headerButton, styles.iosHeaderFix]}
            >
              <MaterialIcons name="arrow-back" size={20} color="#007AFF" />
            </TouchableOpacity>
          ),
          presentation: 'modal',
          headerStyle: {
            backgroundColor: '#f8f9fa',
          },
        }} 
      />
      <Stack.Screen 
        name="stats" 
        options={{ 
          headerTitle: () => (
            <View style={[styles.headerTitleContainer, styles.iosHeaderFix]}>
              <MaterialIcons name="bar-chart" size={22} color="#007AFF" style={styles.headerIcon} />
              <Text style={styles.headerText}>Statistiques</Text>
            </View>
          ),
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/stock')}
              style={[styles.headerButton, styles.iosHeaderFix]}
            >
              <MaterialIcons name="arrow-back" size={22} color="#007AFF" />
            </TouchableOpacity>
          ),
          presentation: 'modal',
          headerStyle: {
            backgroundColor: '#f8f9fa',
          },
        }} 
      />
      <Stack.Screen 
        name="labels" 
        options={{ 
          headerTitle: () => (
            <View style={[styles.headerTitleContainer, styles.iosHeaderFix]}>
              <MaterialIcons name="label" size={22} color="#007AFF" style={styles.headerIcon} />
              <Text style={styles.headerText}>Étiquettes</Text>
            </View>
          ),
          presentation: 'modal',
          headerStyle: {
            backgroundColor: '#f8f9fa',
          },
        }} 
      />
      <Stack.Screen 
        name="backup" 
        options={{ 
          headerTitle: () => (
            <View style={[styles.headerTitleContainer, styles.iosHeaderFix]}>
              <MaterialIcons name="backup" size={22} color="#007AFF" style={styles.headerIcon} />
              <Text style={styles.headerText}>Sauvegarde</Text>
            </View>
          ),
          presentation: 'modal',
          headerStyle: {
            backgroundColor: '#f8f9fa',
          },
        }} 
      />
      <Stack.Screen 
        name="containers" 
        options={{ 
          headerTitle: () => (
            <View style={[styles.headerTitleContainer, styles.iosHeaderFix]}>
              <MaterialIcons name="inbox" size={22} color="#007AFF" style={styles.headerIcon} />
              <Text style={styles.headerText}>Containers</Text>
            </View>
          ),
          presentation: 'modal',
          headerStyle: {
            backgroundColor: '#f8f9fa',
          },
        }} 
      />
      <Stack.Screen 
        name="categories" 
        options={{ 
          headerTitle: () => (
            <View style={[styles.headerTitleContainer, styles.iosHeaderFix]}>
              <MaterialIcons name="category" size={22} color="#007AFF" style={styles.headerIcon} />
              <Text style={styles.headerText}>Catégories</Text>
            </View>
          ),
          presentation: 'modal',
          headerStyle: {
            backgroundColor: '#f8f9fa',
          },
        }} 
      />
      <Stack.Screen 
        name="add-category" 
        options={{ 
          headerTitle: () => (
            <View style={[styles.headerTitleContainer, styles.iosHeaderFix]}>
              <MaterialIcons name="add-circle-outline" size={22} color="#007AFF" style={styles.headerIcon} />
              <Text style={styles.headerText}>Nouvelle catégorie</Text>
            </View>
          ),
          presentation: 'modal',
          headerStyle: {
            backgroundColor: '#f8f9fa',
          },
        }} 
      />
      <Stack.Screen 
        name="edit-category" 
        options={{ 
          headerTitle: () => (
            <View style={[styles.headerTitleContainer, styles.iosHeaderFix]}>
              <MaterialIcons name="edit" size={22} color="#007AFF" style={styles.headerIcon} />
              <Text style={styles.headerText}>Modifier la catégorie</Text>
            </View>
          ),
          presentation: 'modal',
          headerStyle: {
            backgroundColor: '#f8f9fa',
          },
        }} 
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    marginHorizontal: -8,
    height: Platform.OS === 'ios' ? 32 : 44,
  },
  iosHeaderFix: Platform.select({
    ios: {
      height: 24,
      maxHeight: 24,
      transform: [{ translateY: -12 }],
    },
    default: {}
  }),
  headerIcon: {
    marginRight: 4,
  },
  headerText: {
    fontSize: Platform.OS === 'ios' ? 15 : 17,
    fontWeight: '600',
    lineHeight: Platform.OS === 'ios' ? 18 : 22,
  },
  headerButton: {
    padding: 4,
    marginLeft: -4,
    height: Platform.OS === 'ios' ? 32 : 44,
    justifyContent: 'center',
  },
}); 