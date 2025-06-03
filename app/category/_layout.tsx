import React from 'react';
import { Stack } from 'expo-router';
import { useAppTheme } from '../../src/contexts/ThemeContext';

export default function CategoryMainLayout() {
  const { activeTheme } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false, // Utiliser CommonHeader dans chaque page
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{
          title: "Catégories",
        }}
      />
      <Stack.Screen 
        name="add" 
        options={{
          title: "Ajouter Catégorie",
        }}
      />
      <Stack.Screen 
        name="[id]" 
        options={{
          title: "Catégorie",
        }}
      />
    </Stack>
  );
} 