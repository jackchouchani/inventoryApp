import "expo-router/entry";
import { Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// Override MaterialIcons to use Google Fonts on web
if (Platform.OS === 'web') {
  MaterialIcons.font = {
    fontFamily: 'Material Icons',
    fontWeight: 'normal',
    fontStyle: 'normal',
  };
}
