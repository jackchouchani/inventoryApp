import React from 'react';
import { Stack } from 'expo-router';

export default function CategoryLayout() {

  return (
    <Stack
      screenOptions={{
        headerShown: false, // Utiliser CommonHeader dans chaque page
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen 
        name="edit" 
        options={{
          title: "Éditer Catégorie",
        }}
      />
      <Stack.Screen 
        name="content" 
        options={{
          title: "Articles de la catégorie",
        }}
      />
    </Stack>
  );
} 