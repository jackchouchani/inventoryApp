import { useCallback } from 'react';
import {
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
  WithSpringConfig,
  WithTimingConfig,
  Easing,
  EasingFunction,
} from 'react-native-reanimated';

type SpringConfig = {
  damping: number;
  stiffness: number;
  mass: number;
  overshootClamping?: boolean;
  restDisplacementThreshold?: number;
  restSpeedThreshold?: number;
} & WithSpringConfig;

type TimingConfig = {
  duration: number;
  easing: EasingFunction;
} & WithTimingConfig;

export interface AnimationConfig {
  duration?: number;
  springConfig?: SpringConfig;
  timingConfig?: TimingConfig;
}

const defaultSpringConfig: SpringConfig = {
  damping: 10,
  stiffness: 100,
  mass: 1,
};

const defaultTimingConfig: TimingConfig = {
  duration: 300,
  easing: Easing.bezier(0.4, 0, 0.2, 1) as unknown as EasingFunction,
};

export const useAnimatedComponents = () => {
  // Animation de fade
  const opacity = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const fadeIn = useCallback((config?: AnimationConfig) => {
    opacity.value = withTiming(1, {
      duration: config?.duration || defaultTimingConfig.duration,
      easing: config?.timingConfig?.easing || defaultTimingConfig.easing,
    });
  }, [opacity]);

  const fadeOut = useCallback((config?: AnimationConfig) => {
    opacity.value = withTiming(0, {
      duration: config?.duration || defaultTimingConfig.duration,
      easing: config?.timingConfig?.easing || defaultTimingConfig.easing,
    });
  }, [opacity]);

  // Animation de scale
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const scaleUp = useCallback((config?: AnimationConfig) => {
    scale.value = withSpring(1.1, {
      damping: config?.springConfig?.damping || defaultSpringConfig.damping,
      stiffness: config?.springConfig?.stiffness || defaultSpringConfig.stiffness,
      mass: config?.springConfig?.mass || defaultSpringConfig.mass,
    });
  }, [scale]);

  const scaleDown = useCallback((config?: AnimationConfig) => {
    scale.value = withSpring(1, {
      damping: config?.springConfig?.damping || defaultSpringConfig.damping,
      stiffness: config?.springConfig?.stiffness || defaultSpringConfig.stiffness,
      mass: config?.springConfig?.mass || defaultSpringConfig.mass,
    });
  }, [scale]);

  // Animation de slide
  const translateY = useSharedValue(0);
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const slideIn = useCallback((config?: AnimationConfig) => {
    translateY.value = withSpring(0, {
      damping: 15,
      stiffness: config?.springConfig?.stiffness || defaultSpringConfig.stiffness,
      mass: config?.springConfig?.mass || defaultSpringConfig.mass,
    });
  }, [translateY]);

  const slideOut = useCallback((config?: AnimationConfig) => {
    translateY.value = withSpring(100, {
      damping: 15,
      stiffness: config?.springConfig?.stiffness || defaultSpringConfig.stiffness,
      mass: config?.springConfig?.mass || defaultSpringConfig.mass,
    });
  }, [translateY]);

  // Animation de rotation
  const rotation = useSharedValue(0);
  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotation.value}deg` }],
  }));

  const rotate = useCallback((toValue: number, config?: AnimationConfig) => {
    rotation.value = withSpring(toValue, {
      damping: config?.springConfig?.damping || defaultSpringConfig.damping,
      stiffness: config?.springConfig?.stiffness || defaultSpringConfig.stiffness,
      mass: config?.springConfig?.mass || defaultSpringConfig.mass,
    });
  }, [rotation]);

  return {
    // Fade animation
    opacity,
    fadeIn,
    fadeOut,
    fadeStyle,
    // Scale animation
    scale,
    scaleUp,
    scaleDown,
    scaleStyle,
    // Slide animation
    translateY,
    slideIn,
    slideOut,
    slideStyle,
    // Rotate animation
    rotation,
    rotate,
    rotateStyle,
  };
};

// Configurations d'animation prédéfinies
export const ANIMATION_PRESETS = {
  FAST: {
    duration: 150,
    timingConfig: {
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    },
  },
  SMOOTH: {
    duration: 300,
    timingConfig: {
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    },
  },
  BOUNCE: {
    springConfig: {
      damping: 8,
      stiffness: 100,
      mass: 1,
    },
  },
  ELASTIC: {
    springConfig: {
      damping: 4,
      stiffness: 100,
      mass: 1,
    },
  },
} as const; 