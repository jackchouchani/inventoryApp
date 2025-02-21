import { useColorScheme } from 'react-native';

export interface Theme {
  colors: {
    primary: string;
    success: string;
    background: string;
    card: string;
    text: string;
    border: string;
  };
}

const lightTheme: Theme = {
  colors: {
    primary: '#007AFF',
    success: '#34C759',
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#1a1a1a',
    border: '#f5f5f5',
  },
};

const darkTheme: Theme = {
  colors: {
    primary: '#0A84FF',
    success: '#30D158',
    background: '#000000',
    card: '#1C1C1E',
    text: '#FFFFFF',
    border: '#38383A',
  },
};

export const useTheme = (): Theme => {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkTheme : lightTheme;
}; 