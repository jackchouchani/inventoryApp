import { loadFonts } from './src/config/fonts';
import { Platform } from 'react-native';

if (Platform.OS === 'web') {
    loadFonts().catch(console.error);
}

import "expo-router/entry";