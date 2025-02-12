import { Audio } from 'expo-av';

const soundFiles = {
    success: require('../../assets/sounds/success.mp3'),
    error: require('../../assets/sounds/error.mp3'),
};

export const play = async (soundName: 'success' | 'error') => {
    try {
        const { sound } = await Audio.Sound.createAsync(soundFiles[soundName]);
        await sound.playAsync();
    } catch (error) {
        console.error('Erreur lors de la lecture du son:', error);
    }
};
