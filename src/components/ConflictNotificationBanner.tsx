import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform
} from 'react-native';
import {
  Button,
  Chip,
  IconButton,
  Surface
} from 'react-native-paper';
import { router } from 'expo-router';
import { ConflictRecord } from '../database/localDatabase';
import { ConflictDetector } from '../services/ConflictDetector';
import { useAppTheme } from '../hooks/useTheme';
import { useNetwork } from '../contexts/NetworkContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ConflictNotificationBannerProps {
  visible?: boolean;
  onDismiss?: () => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const ConflictNotificationBanner: React.FC<ConflictNotificationBannerProps> = ({
  visible = true,
  onDismiss,
  autoRefresh = true,
  refreshInterval = 30000 // 30 secondes
}) => {
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [slideAnim] = useState(new Animated.Value(-60));

  const { activeTheme } = useAppTheme();
  const { isOnline } = useNetwork();
  const conflictDetector = ConflictDetector.getInstance();

  /**
   * Charger les conflits non résolus
   */
  const loadConflicts = useCallback(async () => {
    // Désactiver les notifications de conflits sur mobile (IndexedDB n'est pas disponible)
    if (Platform.OS !== 'web') {
      return;
    }
    
    try {
      const unresolvedConflicts = await conflictDetector.getUnresolvedConflicts();
      const previousCount = conflicts.length;
      setConflicts(unresolvedConflicts);
      setLastCheck(new Date());
      
      // Réinitialiser le dismiss seulement si de nouveaux conflits apparaissent
      if (unresolvedConflicts.length > previousCount && previousCount === 0) {
        setIsDismissed(false);
      }
      
      // Afficher la bannière s'il y a des conflits et qu'elle n'a pas été dismissée
      if (unresolvedConflicts.length > 0 && !isDismissed) {
        setIsVisible(true);
      } else if (unresolvedConflicts.length === 0) {
        setIsVisible(false);
        setIsDismissed(false); // Reset pour la prochaine fois
      }
    } catch (error) {
      console.error('Erreur chargement conflits notification:', error);
    }
  }, [isDismissed, conflictDetector, conflicts.length]);

  /**
   * Animer l'affichage de la bannière
   */
  const _showBanner = useCallback(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8
    }).start();
  }, [slideAnim]);

  /**
   * Animer la disparition de la bannière
   */
  const hideBanner = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -60,
      duration: 300,
      useNativeDriver: true
    }).start(() => {
      setIsVisible(false);
    });
  }, [slideAnim]);

  /**
   * Gérer le dismiss de la bannière
   */
  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    hideBanner();
    onDismiss?.();
  }, [hideBanner, onDismiss]);

  /**
   * Naviguer vers l'écran de gestion des conflits
   */
  const handleViewConflicts = useCallback(() => {
    router.push('/(stack)/conflicts');
    handleDismiss();
  }, [handleDismiss]);

  /**
   * Obtenir le type de conflit le plus critique
   */
  const getMostCriticalConflictType = useCallback(() => {
    if (conflicts.length === 0) return null;
    
    // Ordre de priorité des conflits (du plus critique au moins critique)
    const priority = ['DELETE_UPDATE', 'UPDATE_UPDATE', 'CREATE_CREATE', 'MOVE_MOVE'];
    
    for (const type of priority) {
      if (conflicts.some(c => c.type === type)) {
        return type;
      }
    }
    
    return conflicts[0].type;
  }, [conflicts]);

  /**
   * Obtenir la description du type de conflit
   */
  const getConflictTypeDescription = useCallback((type: string) => {
    const descriptions: { [key: string]: string } = {
      'UPDATE_UPDATE': 'Modifications simultanées',
      'DELETE_UPDATE': 'Suppressions vs modifications',
      'CREATE_CREATE': 'Créations dupliquées',
      'MOVE_MOVE': 'Déplacements simultanés'
    };
    return descriptions[type] || type;
  }, []);

  /**
   * Obtenir la couleur selon la criticité
   */
  const getConflictColor = useCallback((type: string) => {
    const colors: { [key: string]: string } = {
      'DELETE_UPDATE': activeTheme.error,
      'UPDATE_UPDATE': activeTheme.warning,
      'CREATE_CREATE': activeTheme.primary,
      'MOVE_MOVE': activeTheme.secondary
    };
    return colors[type] || activeTheme.border;
  }, [activeTheme]);

  // Configurer le refresh automatique
  useEffect(() => {
    if (!autoRefresh || !isOnline) return;

    const interval = setInterval(loadConflicts, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, isOnline, refreshInterval, loadConflicts]);

  // Charger les conflits au montage
  useEffect(() => {
    if (visible && isOnline) {
      loadConflicts();
    }
  }, [visible, isOnline, loadConflicts]);

  // Déclencher l'animation quand la bannière devient visible
  useEffect(() => {
    if (isVisible) {
      _showBanner();
    }
  }, [isVisible, _showBanner]);

  // Ne pas réinitialiser le dismiss automatiquement pour éviter la répétition
  // useEffect(() => {
  //   if (isOnline && isDismissed) {
  //     setIsDismissed(false);
  //   }
  // }, [isOnline, isDismissed]);

  if (!visible || !isVisible || conflicts.length === 0 || !isOnline) {
    return null;
  }

  const mostCriticalType = getMostCriticalConflictType();
  const conflictColor = mostCriticalType ? getConflictColor(mostCriticalType) : activeTheme.error;

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      transform: [{ translateY: slideAnim }],
    },
    banner: {
      backgroundColor: conflictColor,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 12,
      color: '#FFFFFF',
      opacity: 0.9,
    },
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionButton: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
    dismissButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <Animated.View style={styles.container}>
      <View style={styles.banner}>
        <View style={styles.content}>
          {/* Icône d'alerte */}
          <View style={styles.iconContainer}>
            <IconButton
              icon="alert"
              size={18}
              iconColor="#FFFFFF"
              style={{ margin: 0 }}
            />
          </View>

          {/* Texte principal */}
          <View style={styles.textContainer}>
            <Text style={styles.title}>
              {conflicts.length} conflit{conflicts.length > 1 ? 's' : ''} détecté{conflicts.length > 1 ? 's' : ''}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {mostCriticalType ? getConflictTypeDescription(mostCriticalType) : 'Conflits de synchronisation'}
              {conflicts.length > 1 && ' et autres'}
            </Text>
          </View>
        </View>

        {/* Actions compactes */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleViewConflicts}>
            <Text style={styles.actionButtonText}>Voir</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
            <IconButton
              icon="close"
              size={16}
              iconColor="#FFFFFF"
              style={{ margin: 0 }}
            />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

export default ConflictNotificationBanner;