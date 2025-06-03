import React from 'react';
import { Stack } from 'expo-router';

export default function ContainerLayout() {

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
          title: "Éditer Container",
        }}
      />
      <Stack.Screen 
        name="content" 
        options={{
          title: "Contenu Container",
        }}
      />
    </Stack>
  );
} 