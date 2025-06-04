import { useEffect, useRef } from 'react';
import {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
  Easing,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { Dimensions } from 'react-native';
import { useAnimatedComponents, ANIMATION_PRESETS } from './useAnimatedComponents';
import { ScannerState } from './useScannerStateMachine';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCANNER_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.7;

export const useScannerAnimations = (scannerState: ScannerState) => {
  // Utiliser les animations de base
  const { fadeIn, fadeOut, fadeStyle, scaleStyle, scaleUp, scaleDown } = useAnimatedComponents();
  
  // Valeurs animées spécifiques au scanner
  const scanLinePosition = useSharedValue(0);
  const scannerScale = useSharedValue(1);
  const overlayOpacity = useSharedValue(0.7);
  const successAnimation = useSharedValue(0);
  const processingProgress = useSharedValue(0);
  const finalSuccessScale = useSharedValue(1);
  const finalSuccessRotate = useSharedValue(0);
  
  // Référence pour contrôler l'état du scan
  const scanActive = useRef(true);

  // Style animé pour la ligne de scan
  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLinePosition.value * SCANNER_SIZE }],
    opacity: scanActive.current ? 1 : 0,
  }));

  // Style animé pour le conteneur du scanner
  const scannerContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scannerScale.value }],
  }));

  // Style animé pour l'overlay
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));
  
  // Style animé pour l'animation de succès de scan
  const successStyle = useAnimatedStyle(() => ({
    opacity: successAnimation.value,
    transform: [
      { scale: interpolate(successAnimation.value, [0, 0.5, 1], [0.8, 1.2, 1], Extrapolate.CLAMP) }
    ]
  }));
  
  // Style animé pour la barre de progression
  const progressStyle = useAnimatedStyle(() => ({
    width: `${processingProgress.value * 100}%`,
  }));

  // Style animé pour le succès final
  const finalSuccessStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: finalSuccessScale.value },
      { rotate: `${finalSuccessRotate.value * 360}deg` }
    ]
  }));

  // Contrôler les animations selon l'état du scanner
  useEffect(() => {
    const isScanning = scannerState.status === 'ready' || scannerState.status === 'scanning_items';
    
    if (isScanning) {
      scanActive.current = true;
      
      // Animation de la ligne de scan
      scanLinePosition.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: 2000, easing: Easing.linear })
        ),
        -1
      );
      
      // Animation de pulsation légère du scanner
      scannerScale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1000, easing: Easing.ease }),
          withTiming(1, { duration: 1000, easing: Easing.ease })
        ),
        -1
      );
    } else {
      scanActive.current = false;
      scanLinePosition.value = withTiming(0);
      scannerScale.value = withTiming(1);
    }
  }, [scannerState.status, scanLinePosition, scannerScale]);

  // Animation de l'overlay selon l'état
  useEffect(() => {
    const shouldShowOverlay = scannerState.status !== 'initializing';
    overlayOpacity.value = withTiming(shouldShowOverlay ? 0.7 : 0, { duration: 300 });
  }, [scannerState.status, overlayOpacity]);

  // Animation de progression
  useEffect(() => {
    if (scannerState.status === 'processing') {
      processingProgress.value = withTiming(scannerState.progress, { duration: 300 });
    } else {
      processingProgress.value = 0;
    }
  }, [scannerState, processingProgress]);

  // Fonctions d'animation
  const triggerSuccessAnimation = () => {
    successAnimation.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(1, { duration: 800 }),
      withTiming(0, { duration: 200 })
    );
  };

  const triggerFinalSuccessAnimation = () => {
    finalSuccessScale.value = withSequence(
      withTiming(1.5, { duration: 300 }),
      withTiming(1, { duration: 300 })
    );
    finalSuccessRotate.value = withTiming(1, { duration: 600 });
  };

  const pulseScale = () => {
    scaleUp({ springConfig: ANIMATION_PRESETS.BOUNCE.springConfig });
    setTimeout(() => {
      scaleDown({ springConfig: ANIMATION_PRESETS.BOUNCE.springConfig });
    }, 150);
  };

  const smoothFadeIn = () => {
    fadeIn({ duration: 300 });
  };

  const smoothFadeOut = () => {
    fadeOut({ duration: 300 });
  };

  const startScanLineAnimation = () => {
    scanActive.current = true;
    scanLinePosition.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: 2000, easing: Easing.linear })
      ),
      -1
    );
  };

  const stopScanLineAnimation = () => {
    scanActive.current = false;
    scanLinePosition.value = withTiming(0);
  };

  return {
    // Styles animés
    scanLineStyle,
    scannerContainerStyle,
    overlayStyle,
    successStyle,
    progressStyle,
    finalSuccessStyle,
    fadeStyle,
    scaleStyle,
    
    // Fonctions d'animation
    triggerSuccessAnimation,
    triggerFinalSuccessAnimation,
    pulseScale,
    smoothFadeIn,
    smoothFadeOut,
    startScanLineAnimation,
    stopScanLineAnimation,
    
    // Valeurs partagées pour contrôle direct si nécessaire
    scanLinePosition,
    scannerScale,
    overlayOpacity,
    successAnimation,
    processingProgress,
    finalSuccessScale,
    finalSuccessRotate
  };
}; 