import React from 'react';
import { Stack } from 'expo-router';
import { useUserPermissions } from '../../../src/hooks/useUserPermissions';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function AdminLayout() {
  const userPermissions = useUserPermissions();
  const router = useRouter();

  useEffect(() => {
    // Rediriger si l'utilisateur n'est pas admin
    if (!userPermissions.isAdmin) {
      router.replace('/(tabs)/stock');
    }
  }, [userPermissions.isAdmin, router]);

  // Ne pas afficher le layout si l'utilisateur n'est pas admin
  if (!userPermissions.isAdmin) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="permissions"
        options={{
          title: 'Gestion des Permissions',
        }}
      />
    </Stack>
  );
}