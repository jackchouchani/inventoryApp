import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from 'react-native-paper';
import { useNetwork } from '../contexts/NetworkContext';
import { useAppTheme } from '../hooks/useTheme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const OfflineIndicator: React.FC = () => {
  const { 
    isOnline, 
    isInternetReachable, 
    pendingOperationsCount, 
    lastOnlineTime
  } = useNetwork();
  const { activeTheme } = useAppTheme();

  const isOffline = !isOnline || !isInternetReachable;

  if (!isOffline) {
    return null;
  }

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return format(date, 'HH:mm', { locale: fr });
  };

  const getOfflineMessage = () => {
    let message = 'Mode hors ligne';
    
    if (pendingOperationsCount > 0) {
      message += ` • ${pendingOperationsCount} modification${pendingOperationsCount > 1 ? 's' : ''} en attente`;
    }
    
    if (lastOnlineTime) {
      message += ` • Dernière sync: ${formatTime(lastOnlineTime)}`;
    }
    
    return message;
  };

  const styles = StyleSheet.create({
    container: {
      height: 20,
      backgroundColor: activeTheme.warning || '#ff9800',
      width: '100%',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: {
      color: '#000',
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    iconContainer: {
      marginRight: 4,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon 
          source="wifi-off" 
          size={12} 
          color="#000"
        />
      </View>
      <Text style={styles.text} numberOfLines={1}>
        {getOfflineMessage()}
      </Text>
    </View>
  );
};

export default OfflineIndicator;