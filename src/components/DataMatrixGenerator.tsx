import React, { useEffect, useState, useMemo } from 'react';
import { View, Image, Platform, Text, ActivityIndicator } from 'react-native';
import { parseId } from '../utils/identifierManager';
import bwipjs from 'bwip-js';
import * as Sentry from '@sentry/react-native';
import { ErrorBoundary } from '../components/ErrorBoundary';

const MAX_SIZE = 1000; // Taille maximale pour des raisons de performance
const MIN_SIZE = 50;   // Taille minimale pour la lisibilité

interface DataMatrixGeneratorProps {
  /** Identifiant unique de l'article à encoder */
  value: string;
  /** Taille en pixels du code DataMatrix (50-1000px) */
  size?: number;
  /** Couleur du code en format hexadécimal */
  color?: string;
  /** Couleur de fond en format hexadécimal */
  backgroundColor?: string;
}

const DataMatrixContent: React.FC<DataMatrixGeneratorProps> = ({
  value,
  size = 200,
  color = '#000000',
  backgroundColor = '#ffffff'
}) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Validation des props
  const validatedSize = useMemo(() => {
    return Math.min(Math.max(size, MIN_SIZE), MAX_SIZE);
  }, [size]);

  // Validation de l'identifiant
  const { type } = parseId(value);
  const isValidItem = type === 'ITEM';
   
  useEffect(() => {
    if (!isValidItem) {
      setError('Identifiant d\'article invalide');
      return;
    }

    const generateDataMatrix = async () => {
      try {
        const options = {
          bcid: 'datamatrix',
          text: value,
          scale: 3,
          height: 10,
          width: 10,
          backgroundcolor: backgroundColor.slice(1),
          barcolor: color.slice(1),
          includetext: false,
        };

        if (Platform.OS === 'web') {
          const canvas = document.createElement('canvas');
          // @ts-ignore - bwipjs types are incorrect
          await bwipjs.toCanvas(canvas, options);
          setImageSrc(canvas.toDataURL('image/png'));
        } else {
          const png = await bwipjs.toBuffer(options);
          const base64 = Buffer.from(png).toString('base64');
          setImageSrc(`data:image/png;base64,${base64}`);
        }
        
        setError(null);
      } catch (error) {
        const errorMessage = 'Erreur lors de la génération du code DataMatrix';
        setError(errorMessage);
        
        Sentry.captureException(error, {
          tags: { component: 'DataMatrixGenerator' },
          extra: { value, size: validatedSize },
        });
      }
    };

    generateDataMatrix();
  }, [value, validatedSize, color, backgroundColor, isValidItem]);

  if (error) {
    return (
      <View style={{ width: validatedSize, height: validatedSize, backgroundColor: '#ffebee', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#d32f2f', textAlign: 'center', padding: 10 }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={{ 
      width: validatedSize, 
      height: validatedSize, 
      backgroundColor, 
      padding: validatedSize * 0.1,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      {imageSrc ? (
        <Image
          source={{ uri: imageSrc }}
          style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
          testID="datamatrix-image"
        />
      ) : (
        <ActivityIndicator size="large" color={color} />
      )}
    </View>
  );
};

/**
 * Génère un code DataMatrix pour un article
 * @param props - Propriétés du composant
 * @returns Composant React avec le code DataMatrix
 */
export const DataMatrixGenerator: React.FC<DataMatrixGeneratorProps> = React.memo((props) => {
  return (
    <ErrorBoundary>
      <DataMatrixContent {...props} />
    </ErrorBoundary>
  );
});

DataMatrixGenerator.displayName = 'DataMatrixGenerator'; 