import { Audio } from 'expo-av';

const loadSound = async (soundFile: any) => {
  const { sound } = await Audio.Sound.createAsync(soundFile);
  return sound;
};

export const playSuccessSound = async () => {
  try {
    const sound = await loadSound(require('../../assets/sounds/success.mp3'));
    await sound.playAsync();
    sound.unloadAsync();
  } catch (error) {
    console.error('Erreur son:', error);
  }
};

export const playErrorSound = async () => {
  try {
    const sound = await loadSound(require('../../assets/sounds/error.mp3'));
    await sound.playAsync();
    sound.unloadAsync();
  } catch (error) {
    console.error('Erreur son:', error);
  }
};
