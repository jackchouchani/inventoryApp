import React from 'react';
import { Stack } from 'expo-router';
import { Provider } from 'react-redux';
import { store } from '../src/store/store';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function Layout() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: '#fff',
            },
            headerTintColor: '#007AFF',
          }}
        >
          <Stack.Screen 
            name="index"
            options={{
              headerShown: false
            }}
          />
          <Stack.Screen 
            name="stock/index"
            options={{
              title: 'Stock'
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </Provider>
  );
} 