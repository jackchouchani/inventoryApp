export const theme = {
  colors: {
    primary: '#007AFF',
    secondary: '#6c757d',
    background: '#f5f5f5',
    surface: '#ffffff',
    error: '#ff4444',
    text: {
      primary: '#333333',
      secondary: '#666666',
      disabled: '#999999',
      inverse: '#ffffff'
    },
    border: '#dddddd',
    shadow: '#000000'
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
    lg: 16
  },
  typography: {
    h1: {
      fontSize: 24,
      fontWeight: 'bold'
    },
    h2: {
      fontSize: 20,
      fontWeight: 'bold'
    },
    body: {
      fontSize: 16
    },
    caption: {
      fontSize: 14
    }
  },
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4
    }
  }
};

export type Theme = typeof theme;