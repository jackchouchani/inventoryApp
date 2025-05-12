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
        name="labels" 
        options={{
          animation: 'slide_from_bottom'
        }}
      />
      <Stack.Screen 
        name="containers" 
        options={{
          animation: 'slide_from_right'
        }}
      />
      <Stack.Screen 
        name="categories" 
        options={{
          animation: 'slide_from_right'
        }}
      />
      <Stack.Screen 
        name="add-category" 
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom'
        }}
      />
      <Stack.Screen 
        name="edit-category" 
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom'
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