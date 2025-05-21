import * as Font from 'expo-font';

export const loadFonts = async () => {
  await Font.loadAsync({
    'Material Icons': require('../../assets/fonts/MaterialIcons.ttf'),
  });
};