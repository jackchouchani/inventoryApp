import { Audio } from 'expo-av';

const loadSound = async (soundFile: any) => {
  const sound = new Audio.Sound();
  try {
    await sound.loadAsync(soundFile);
    return sound;
  } catch (error) {
    console.error('Erreur lors du chargement du son:', error);
    return null;
  }
};

export const playSuccessSound = async () => {
  try {
    const sound = await loadSound(require('../assets/sounds/success.mp3'));
    if (sound) {
      await sound.playAsync();
      await sound.unloadAsync();
    }
  } catch (error) {
    console.error('Erreur lors de la lecture du son:', error);
  }
};

export const playErrorSound = async () => {
  try {
    const sound = await loadSound(require('../assets/sounds/error.mp3'));
    if (sound) {
      await sound.playAsync();
      await sound.unloadAsync();
    }
  } catch (error) {
    console.error('Erreur lors de la lecture du son:', error);
  }
};
