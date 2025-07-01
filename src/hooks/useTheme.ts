import { useAppTheme, AppThemeType } from '../contexts/ThemeContext';

/**
 * Custom hook to access the current theme (light or dark).
 * This now uses the global ThemeProvider.
 */
export const useTheme = (): AppThemeType => {
  const { activeTheme } = useAppTheme();
  return activeTheme;
};

// Re-export useAppTheme for backward compatibility
export { useAppTheme };

export type { AppThemeType as Theme }; // Re-export for compatibility if needed