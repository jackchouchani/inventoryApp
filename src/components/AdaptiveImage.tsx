import React from 'react';
import { Image, ImageProps, Platform, StyleSheet } from 'react-native';

interface AdaptiveImageProps extends Omit<ImageProps, 'source'> {
  uri?: string;
  quality?: 'NORMAL' | 'LOW' | 'HIGH';
}

const AdaptiveImage: React.FC<AdaptiveImageProps> = ({ uri, quality = 'NORMAL', style, ...props }) => {
  if (!uri) return null;

  if (Platform.OS === 'web') {
    const flattenedStyle = StyleSheet.flatten(style) || {};
    return (
      <div
        style={{
          width: flattenedStyle.width || '100%',
          height: flattenedStyle.height || '100%',
          borderRadius: flattenedStyle.borderRadius || 0,
          backgroundImage: `url(${uri})`,
          backgroundSize: props.resizeMode || 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    );
  }

  return (
    <Image
      style={style}
      {...props}
      source={{ uri }}
      resizeMode={props.resizeMode || 'cover'}
    />
  );
};

export default AdaptiveImage; 