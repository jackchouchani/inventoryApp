import React from 'react';
import { Stack } from 'expo-router';
import { useAppTheme } from '../../src/contexts/ThemeContext';

export default function ItemLayout() {
  const { activeTheme } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        presentation: 'card',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        contentStyle: {
          backgroundColor: activeTheme.background,
        },
      }}
    >
      <Stack.Screen 
        name="[id]" 
        options={{
          animation: 'slide_from_right',
          contentStyle: {
            backgroundColor: activeTheme.background,
          },
        }}
      />
    </Stack>
  );
} 