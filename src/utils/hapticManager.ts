import * as Haptics from 'expo-haptics';

export const triggerSuccess = async () => {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    console.error('Erreur haptic:', error);
  }
};

export const triggerError = async () => {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (error) {
    console.error('Erreur haptic:', error);
  }
};
