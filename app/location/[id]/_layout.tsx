import React from 'react';
import { Stack } from 'expo-router';

export default function LocationLayout() {

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
          title: "Éditer Emplacement",
        }}
      />
      <Stack.Screen 
        name="content" 
        options={{
          title: "Contenu Emplacement",
        }}
      />
    </Stack>
  );
}