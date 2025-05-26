import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme as baseTheme, Theme as BaseThemeType } from '../utils/theme'; // Import base theme and its type

export type ThemeMode = 'light' | 'dark' | 'system';

// Define the structure of your theme colors (flat structure)
export type ThemeColors = {
  primary: string;
  primaryLight: string;
  secondary: string;
  background: string;
  backgroundSecondary: string;
  surface: string;
  card: string;
  error: string;
  success: string;
  successLight: string;
  warning: string;
  text: {
    primary: string;
    secondary: string;
    disabled: string;
    inverse: string;
    onPrimary: string; // For text on primary-colored backgrounds
  };
  border: string;
  backdrop: string;
  danger: {
    main: string;
    light: string; // Added light variant for danger
    text: string;
    background: string;
  };
  // ... any other colors
};

// Define the comprehensive AppThemeType
export type AppThemeType = ThemeColors & Pick<BaseThemeType, 'spacing' | 'typography' | 'borderRadius' | 'shadows'>;

// Define the light theme colors
const lightTheme: AppThemeType = {
  primary: '#007AFF',        // Blue
  primaryLight: '#E8F4FD',   // Light blue for backgrounds or highlights
  secondary: '#FF9500',      // Orange
  background: '#F2F2F7',    // Very light gray (almost white)
  backgroundSecondary: '#FFFFFF', // White for elements on top of background
  surface: '#FFFFFF',       // White for cards, modals, etc.
  card: '#FFFFFF',
  error: '#FF3B30',         // Red
  success: '#34C759',       // Green
  successLight: '#E0F7E0',  // Light green for backgrounds
  warning: '#FFCC00',       // Yellow
  text: {
    primary: '#000000',   // Black
    secondary: '#666666', // Gray
    disabled: '#C0C0C0', // Light gray
    inverse: '#FFFFFF',    // White
    onPrimary: '#FFFFFF',  // White text on primary background
  },
  border: '#D1D1D6',       // Light gray
  backdrop: 'rgba(0, 0, 0, 0.4)',
  danger: {
    main: '#D32F2F',       // Darker Red
    light: '#FFEBEE',      // Light Red for backgrounds
    text: '#D32F2F',       // Text color for danger states (often same as main)
    background: '#FFCDD2', // Background for danger alerts/inputs
  },
  spacing: baseTheme.spacing,
  typography: baseTheme.typography,
  borderRadius: baseTheme.borderRadius,
  shadows: baseTheme.shadows,
};

// Define the dark theme colors
const darkTheme: AppThemeType = {
  ...lightTheme, // Start with light theme and override
  primary: '#0A84FF',        // Brighter Blue for dark mode
  primaryLight: '#1C3A5E',   // Darker blue variant
  secondary: '#FF9F0A',      // Brighter Orange
  background: '#000000',    // Black
  backgroundSecondary: '#1C1C1E', // Very dark gray (near black)
  surface: '#1C1C1E',       // Very dark gray for cards, modals
  card: '#1C1C1E',
  error: '#FF453A',         // Brighter Red
  success: '#30D158',       // Brighter Green
  successLight: '#0E4B1D',  // Darker green variant
  warning: '#FFD60A',       // Brighter Yellow
  text: {
    primary: '#FFFFFF',   // White
    secondary: '#A0A0A0', // Lighter gray
    disabled: '#505050', // Dark gray
    inverse: '#000000',    // Black
    onPrimary: '#FFFFFF',  // White text on primary background
  },
  border: '#38383A',       // Darker gray
  backdrop: 'rgba(0, 0, 0, 0.6)',
  danger: {
    main: '#FF6B6B',       // Lighter, more vibrant Red for dark mode
    light: '#5E2A2A',      // Darker Red variant for backgrounds
    text: '#FF6B6B',       // Text color for danger states in dark mode
    background: '#4B1F1F', // Background for danger alerts/inputs in dark mode
  },
  spacing: baseTheme.spacing, // Assuming these are the same for dark mode, adjust if needed
  typography: baseTheme.typography,
  borderRadius: baseTheme.borderRadius,
  shadows: baseTheme.shadows,
};

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  activeTheme: AppThemeType;
  // isSystemDark: boolean; // This was in the diff, but not in the original. Removing for now unless needed.
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const systemColorScheme = Appearance.getColorScheme(); // 'light' or 'dark'

  useEffect(() => {
    const loadThemePreference = async () => {
      const storedThemeMode = await AsyncStorage.getItem('themeMode') as ThemeMode | null;
      if (storedThemeMode) {
        setThemeMode(storedThemeMode);
      }
    };
    loadThemePreference();

    const subscription = Appearance.addChangeListener(() => {
      if (themeMode === 'system') {
        // If mode is system, we just trigger a re-render by setting the same mode,
        // which will cause activeTheme to re-evaluate based on the new Appearance.getColorScheme()
        setThemeMode('system'); 
      }
    });
    return () => subscription.remove();
  }, [themeMode]); // Re-run if themeMode changes (e.g. from system to light/dark by user)

  const activeTheme = useMemo(() => {
    if (themeMode === 'light') return lightTheme;
    if (themeMode === 'dark') return darkTheme;
    // System mode
    return systemColorScheme === 'dark' ? darkTheme : lightTheme;
  }, [themeMode, systemColorScheme]);

  const contextValue = useMemo(() => ({
    themeMode,
    setThemeMode: (mode: ThemeMode) => {
      setThemeMode(mode);
      AsyncStorage.setItem('themeMode', mode);
    },
    activeTheme,
  }), [themeMode, activeTheme, setThemeMode]);

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
};
