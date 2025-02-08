import React from 'react';
import { Stack } from 'expo-router';

export default function StackLayout() {
  return (
    <Stack
      screenOptions={{
        // Options communes pour tous les écrans
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTintColor: '#007AFF',
        headerTitleStyle: {
          fontWeight: '600',
        },
        presentation: 'modal',
        animation: 'slide_from_bottom',
        headerBackTitle: "Retour",
        contentStyle: {
          backgroundColor: '#f5f5f5',
        },
        // Assure que le header est toujours visible
        headerShown: true,
      }}
    >
      <Stack.Screen 
        name="settings" 
        options={{ 
          title: "Paramètres",
          presentation: 'modal'
        }} 
      />
      <Stack.Screen 
        name="stats" 
        options={{ 
          title: "Statistiques",
          presentation: 'modal',
          headerBackTitle: "Retour"
        }} 
      />
      <Stack.Screen 
        name="labels" 
        options={{ 
          title: "Étiquettes",
          presentation: 'modal',
          headerBackTitle: "Retour"
        }} 
      />
      <Stack.Screen 
        name="backup" 
        options={{ 
          title: "Sauvegarde",
          presentation: 'modal',
          headerBackTitle: "Retour"
        }} 
      />
      <Stack.Screen 
        name="containers" 
        options={{ 
          title: "Containers",
          presentation: 'modal',
          headerBackTitle: "Retour"
        }} 
      />
      <Stack.Screen 
        name="categories" 
        options={{ 
          title: "Catégories",
          presentation: 'modal',
          headerBackTitle: "Retour"
        }} 
      />
    </Stack>
  );
} 