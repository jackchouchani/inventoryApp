import React from 'react';
import { Stack } from 'expo-router';

export default function ContainerMainLayout() {

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
          title: "Containers",
        }}
      />
      <Stack.Screen 
        name="add" 
        options={{
          title: "Ajouter Container",
        }}
      />
      <Stack.Screen 
        name="[id]" 
        options={{
          title: "Container",
        }}
      />
    </Stack>
  );
} 