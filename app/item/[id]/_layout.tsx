import React from 'react';
import { Stack, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { CommonHeader } from '../../../src/components';
import { useAppTheme } from '../../../src/contexts/ThemeContext';

export default function ItemLayout() {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  const { id, returnTo } = useLocalSearchParams();
  const segments = useSegments();

  const handleGoBack = () => {
    const currentPage = segments[segments.length - 1]; // Dernière partie de l'URL
    
    console.log('[Navigation Debug] Segments:', segments);
    console.log('[Navigation Debug] Current page:', currentPage);
    console.log('[Navigation Debug] ID:', id);
    console.log('[Navigation Debug] ReturnTo raw:', returnTo);
    console.log('[Navigation Debug] ReturnTo type:', typeof returnTo);
    
    if (currentPage === 'edit') {
      // Depuis la page edit, retourner vers la page info de l'article
      console.log('[Navigation] Edit → Info');
      router.replace(`/item/${id}/info${returnTo ? `?returnTo=${returnTo}` : ''}`);
    } else {
      // ✅ UTILISER returnTo si disponible, sinon retour vers stock
      const returnToPath = Array.isArray(returnTo) ? returnTo[0] : returnTo;
      
      if (returnToPath && typeof returnToPath === 'string' && returnToPath.trim() !== '') {
        const decodedPath = decodeURIComponent(returnToPath);
        console.log('[Navigation] Using returnTo path:', decodedPath);
        router.replace(decodedPath);
      } else {
        console.log('[Navigation] No valid returnTo, defaulting to stock');
        router.replace('/(tabs)/stock');
      }
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