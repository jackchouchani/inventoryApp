import React from 'react';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function StackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: Platform.select({
          ios: 'slide_from_right',
          android: 'fade',
        }),
        presentation: 'card',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen 
        name="settings" 
        options={{
          animation: 'slide_from_right'
        }}
      />
      <Stack.Screen 
        name="stats" 
        options={{
          animation: 'slide_from_right'
        }}
      />
      <Stack.Screen 
        name="scanner-info" 
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom'
        }}
      />
    </Stack>
  );
} 