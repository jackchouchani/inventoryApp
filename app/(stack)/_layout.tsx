import React from 'react';
import { Stack } from 'expo-router';

export default function StackLayout() {
  return (
    <Stack>
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