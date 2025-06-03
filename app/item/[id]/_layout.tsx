import React from 'react';
import { Stack, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { CommonHeader } from '../../../src/components';
import { useAppTheme } from '../../../src/contexts/ThemeContext';

export default function ItemLayout() {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  const { id } = useLocalSearchParams();
  const segments = useSegments();

  const handleGoBack = () => {
    const currentPage = segments[segments.length - 1]; // Dernière partie de l'URL
    
    if (currentPage === 'edit') {
      // Depuis la page edit, retourner vers la page info de l'article
      router.replace(`/item/${id}/info`);
    } else if (currentPage === 'info') {
      // Depuis la page info, retourner vers le stock
      router.replace('/stock');
    } else {
      // Cas par défaut
      router.back();
    }
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
        header: ({ options }) => (
          <CommonHeader 
            title={options.title}
            onBackPress={handleGoBack}
          />
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