import React, { useEffect, useState } from 'react';
import { View, Image, Platform } from 'react-native';
import { parseId } from '../utils/identifierManager';
import bwipjs from 'bwip-js';

interface DataMatrixGeneratorProps {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
}

export const DataMatrixGenerator: React.FC<DataMatrixGeneratorProps> = ({
  value,
  size = 200,
  color = '#000000',
  backgroundColor = '#ffffff'
}) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const { type } = parseId(value);
  
  if (type !== 'ITEM') {
    console.warn('DataMatrixGenerator doit être utilisé uniquement pour les articles');
    return null;
  }

  useEffect(() => {
    const generateDataMatrix = async () => {
      try {
        if (Platform.OS === 'web') {
          const canvas = document.createElement('canvas');
          // @ts-ignore
          await bwipjs.toCanvas(canvas, {
            bcid: 'datamatrix',
            text: value,
            scale: 3,
            height: 10,
            width: 10,
            backgroundcolor: backgroundColor.slice(1),
            barcolor: color.slice(1),
            includetext: false,
          });
          setImageSrc(canvas.toDataURL('image/png'));
        } else {
          // Pour les plateformes mobiles
          const png = await bwipjs.toBuffer({
            bcid: 'datamatrix',
            text: value,
            scale: 3,
            height: 10,
            width: 10,
            backgroundcolor: backgroundColor.slice(1),
            barcolor: color.slice(1),
            includetext: false,
          });
          
          const base64 = Buffer.from(png).toString('base64');
          setImageSrc(`data:image/png;base64,${base64}`);
        }
      } catch (error) {
        console.error('Erreur lors de la génération du code DataMatrix:', error);
      }
    };

    generateDataMatrix();
  }, [value, size, color, backgroundColor]);

  return (
    <View style={{ width: size, height: size, backgroundColor, padding: size * 0.1 }}>
      {imageSrc ? (
        <Image
          source={{ uri: imageSrc }}
          style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
        />
      ) : null}
    </View>
  );
}; 