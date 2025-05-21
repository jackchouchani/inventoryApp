export const theme = {
  colors: {
    primary: '#007AFF',
    primaryLight: '#B3DBFF',
    secondary: '#5856D6',
    background: '#F5F5F5',
    backgroundSecondary: '#EFEFEF',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    error: '#FF3B30',
    success: '#4CAF50',
    successLight: '#E8F5E9',
    warning: '#FF9500',
    text: {
      primary: '#000000',
      secondary: '#666666',
      disabled: '#999999',
      inverse: '#FFFFFF'
    },
    border: '#E5E5E5',
    danger: {
      main: '#FF3B30',
      background: '#FFF5F5',
      text: '#FF3B30'
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 20
  },
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: '700'
    },
    h2: {
      fontSize: 24,
      fontWeight: '600'
    },
    body: {
      fontSize: 16,
      fontWeight: '400'
    },
    caption: {
      fontSize: 12,
      fontWeight: '400'
    }
  },
  shadows: {
    sm: {
      boxShadow: '0px 1px 1px rgba(0, 0, 0, 0.20)',
      elevation: 2,
    },
    md: {
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
      elevation: 5,
    }
  }
} as const;

export type Theme = typeof theme;