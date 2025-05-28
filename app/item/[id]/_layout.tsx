import React from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Icon } from '../../../src/components';
import { useAppTheme } from '../../../src/contexts/ThemeContext';

export default function ItemLayout() {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  useLocalSearchParams();

  const handleGoBack = () => {
    router.back();
  };

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: activeTheme.surface,
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
          color: activeTheme.text.primary,
        },
        headerLeft: () => (
          <TouchableOpacity onPress={handleGoBack} style={{ marginLeft: 8 }}>
            <Icon name="arrow_back" size={24} color={activeTheme.primary} />
          </TouchableOpacity>
        ),
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
        name="info" 
        options={{
          title: 'Détails de l\'article',
        }}
      />
      <Stack.Screen 
        name="edit" 
        options={{
          title: 'Modifier l\'article',
        }}
      />
    </Stack>
  );
} 