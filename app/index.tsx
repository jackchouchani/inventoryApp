import React from 'react';
import { Redirect } from 'expo-router';

export default function Index() {
  console.log('Index page rendering');
  return <Redirect href="/(tabs)/stock" />;
} 