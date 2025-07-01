import React from 'react';
import { Stack } from 'expo-router';

export default function LocationMainLayout() {

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
          title: "Emplacements",
        }}
      />
      <Stack.Screen 
        name="add" 
        options={{
          title: "Ajouter Emplacement",
        }}
      />
      <Stack.Screen 
        name="[id]" 
        options={{
          title: "Emplacement",
        }}
      />
    </Stack>
  );
}