import React, { useEffect } from 'react';
import { View, ViewStyle, Animated } from 'react-native';

interface SkeletonProps {
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({ style }) => {
  const animatedValue = new Animated.Value(0);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          backgroundColor: '#e1e1e1',
          opacity,
        },
        style,
      ]}
    />
  );
}; 