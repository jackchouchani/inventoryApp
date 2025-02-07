import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isWeb = Platform.OS === 'web';

export const triggerSuccess = async () => {
  try {
    if (isWeb) {
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch (error) {
    console.error('Erreur vibration:', error);
  }
};

export const triggerError = async () => {
  try {
    if (isWeb) {
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 100, 100]);
      }
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  } catch (error) {
    console.error('Erreur vibration:', error);
  }
};

export const vibrate = async (pattern: number | number[] = 100) => {
  try {
    if (isWeb) {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } else {
      if (Array.isArray(pattern)) {
        await triggerError();
      } else {
        await triggerSuccess();
      }
    }
  } catch (error) {
    console.error('Erreur vibration:', error);
  }
};

export const SUCCESS_PATTERN = 100;
export const ERROR_PATTERN = [100, 100, 100];
