import { useCallback } from 'react';
import {
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  useSharedValue,
  WithSpringConfig,
  WithTimingConfig,
  Easing,
  interpolate,
  Extrapolate,
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
  const useFadeAnimation = (initialValue: number = 0) => {
    const opacity = useSharedValue(initialValue);

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

    const fadeStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
    }));

    return { opacity, fadeIn, fadeOut, fadeStyle };
  };

  // Animation de scale
  const useScaleAnimation = (initialValue: number = 1) => {
    const scale = useSharedValue(initialValue);

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

    const scaleStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return { scale, scaleUp, scaleDown, scaleStyle };
  };

  // Animation de slide
  const useSlideAnimation = (initialValue: number = 0) => {
    const translateY = useSharedValue(initialValue);

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

    const slideStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }],
    }));

    return { translateY, slideIn, slideOut, slideStyle };
  };

  // Animation de rotation
  const useRotateAnimation = (initialValue: number = 0) => {
    const rotation = useSharedValue(initialValue);

    const rotate = useCallback((toValue: number, config?: AnimationConfig) => {
      rotation.value = withSpring(toValue, {
        damping: config?.springConfig?.damping || defaultSpringConfig.damping,
        stiffness: config?.springConfig?.stiffness || defaultSpringConfig.stiffness,
        mass: config?.springConfig?.mass || defaultSpringConfig.mass,
      });
    }, [rotation]);

    const rotateStyle = useAnimatedStyle(() => ({
      transform: [{ rotateZ: `${rotation.value}deg` }],
    }));

    return { rotation, rotate, rotateStyle };
  };

  // Animation de liste avec décalage
  const useListAnimation = (index: number, initialValue: number = 0) => {
    const translateY = useSharedValue(initialValue);
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.8);

    const animateIn = useCallback((config?: AnimationConfig) => {
      const delay = (index * 150) % 1000; // Décalage maximum de 1 seconde
      translateY.value = withDelay(
        delay,
        withSpring(0, {
          damping: config?.springConfig?.damping || defaultSpringConfig.damping,
          stiffness: config?.springConfig?.stiffness || defaultSpringConfig.stiffness,
          mass: config?.springConfig?.mass || defaultSpringConfig.mass,
        })
      );
      opacity.value = withDelay(delay, withTiming(1, {
        duration: config?.duration || defaultTimingConfig.duration,
        easing: config?.timingConfig?.easing || defaultTimingConfig.easing,
      }));
      scale.value = withDelay(delay, withSpring(1, {
        damping: config?.springConfig?.damping || defaultSpringConfig.damping,
        stiffness: config?.springConfig?.stiffness || defaultSpringConfig.stiffness,
        mass: config?.springConfig?.mass || defaultSpringConfig.mass,
      }));
    }, [index, opacity, scale, translateY]);

    const animateOut = useCallback((config?: AnimationConfig) => {
      const delay = (index * 100) % 800; // Décalage maximum de 0.8 seconde
      translateY.value = withDelay(delay, withSpring(100, {
        damping: config?.springConfig?.damping || defaultSpringConfig.damping,
        stiffness: config?.springConfig?.stiffness || defaultSpringConfig.stiffness,
        mass: config?.springConfig?.mass || defaultSpringConfig.mass,
      }));
      opacity.value = withDelay(delay, withTiming(0, {
        duration: config?.duration || defaultTimingConfig.duration,
        easing: config?.timingConfig?.easing || defaultTimingConfig.easing,
      }));
      scale.value = withDelay(delay, withSpring(0.8, {
        damping: config?.springConfig?.damping || defaultSpringConfig.damping,
        stiffness: config?.springConfig?.stiffness || defaultSpringConfig.stiffness,
        mass: config?.springConfig?.mass || defaultSpringConfig.mass,
      }));
    }, [index, opacity, scale, translateY]);

    const style = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    }));

    return { style, animateIn, animateOut };
  };

  // Animation composée/imbriquée
  const useComposedAnimation = (initialValue: number = 0) => {
    const progress = useSharedValue(initialValue);
    const scale = useSharedValue(1);

    const animate = useCallback((config?: AnimationConfig) => {
      const sequence = withSequence(
        withTiming(1, {
          duration: config?.duration || defaultTimingConfig.duration,
          easing: config?.timingConfig?.easing || defaultTimingConfig.easing,
        }),
        withSpring(0.8, {
          damping: config?.springConfig?.damping || defaultSpringConfig.damping,
          stiffness: config?.springConfig?.stiffness || defaultSpringConfig.stiffness,
          mass: config?.springConfig?.mass || defaultSpringConfig.mass,
        }),
        withSpring(1, {
          damping: config?.springConfig?.damping || defaultSpringConfig.damping,
          stiffness: config?.springConfig?.stiffness || defaultSpringConfig.stiffness,
          mass: config?.springConfig?.mass || defaultSpringConfig.mass,
        })
      );

      progress.value = sequence;
      scale.value = withSpring(1.1, {
        damping: config?.springConfig?.damping || defaultSpringConfig.damping,
        stiffness: config?.springConfig?.stiffness || defaultSpringConfig.stiffness,
        mass: config?.springConfig?.mass || defaultSpringConfig.mass,
      });
    }, [progress, scale]);

    const reset = useCallback((config?: AnimationConfig) => {
      progress.value = withTiming(0, {
        duration: config?.duration || defaultTimingConfig.duration,
        easing: config?.timingConfig?.easing || defaultTimingConfig.easing,
      });
      scale.value = withSpring(1, {
        damping: config?.springConfig?.damping || defaultSpringConfig.damping,
        stiffness: config?.springConfig?.stiffness || defaultSpringConfig.stiffness,
        mass: config?.springConfig?.mass || defaultSpringConfig.mass,
      });
    }, [progress, scale]);

    const style = useAnimatedStyle(() => {
      const translateY = interpolate(
        progress.value,
        [0, 0.5, 1],
        [0, -20, 0],
        Extrapolate.CLAMP
      );

      const opacity = interpolate(
        progress.value,
        [0, 0.2, 0.8, 1],
        [0, 1, 1, 0],
        Extrapolate.CLAMP
      );

      return {
        opacity,
        transform: [
          { translateY },
          { scale: scale.value },
        ],
      };
    });

    return { progress, scale, style, animate, reset };
  };

  return {
    useFadeAnimation,
    useScaleAnimation,
    useSlideAnimation,
    useRotateAnimation,
    useListAnimation,
    useComposedAnimation,
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