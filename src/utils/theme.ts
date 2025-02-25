export const theme = {
  colors: {
    primary: '#007AFF',
    secondary: '#5856D6',
    background: '#F5F5F5',
    surface: '#FFFFFF',
    error: '#FF3B30',
    success: '#4CAF50',
    warning: '#FF9500',
    text: {
      primary: '#000000',
      secondary: '#666666',
      disabled: '#999999',
      inverse: '#FFFFFF'
    },
    border: '#E5E5E5',
    shadow: '#000000',
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
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.20,
      shadowRadius: 1.41,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    }
  }
} as const;

export type Theme = typeof theme;