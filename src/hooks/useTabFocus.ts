import { useEffect } from 'react';
import { usePathname } from 'expo-router';

export const useTabFocus = (onFocusLost: () => void) => {
  const pathname = usePathname();

  useEffect(() => {
    // On est dans les tabs si le pathname commence par /(tabs)
    const isInTabs = pathname.startsWith('/(tabs)');
    
    // Si on est dans les tabs mais pas sur l'onglet scan
    if (isInTabs && !pathname.endsWith('/scan')) {
      onFocusLost();
    }
  }, [pathname, onFocusLost]);
}; 