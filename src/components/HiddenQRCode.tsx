import React, { useRef, useEffect, useCallback, memo } from 'react';
import { View, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import { errorHandler, ErrorType } from '../utils/errorHandler';

const MAX_QR_VALUE_LENGTH = 2048;
const QR_CODE_SIZE = 150;
const CAPTURE_DELAY = 100;

interface HiddenQRCodeProps {
  value: string;
  onCapture: (data: string) => void;
  onError?: (error: Error) => void;
}

interface ViewShotType extends ViewShot {
  capture: () => Promise<string>;
}

/**
 * Composant pour générer des QR codes, avec support différent pour web et mobile.
 * @param value - La valeur à encoder dans le QR code
 * @param onCapture - Callback appelé avec l'image du QR code en base64
 * @param onError - Callback optionnel pour la gestion des erreurs
 */
export const HiddenQRCode: React.FC<HiddenQRCodeProps> = memo(({ value, onCapture, onError }) => {
  const viewShotRef = useRef<ViewShotType>(null);

  const handleError = useCallback((error: Error, context: string) => {
    const errorDetails = errorHandler.handleError(error, {
      context: ErrorType.VALIDATION,
      severity: 'error',
      extraData: {
        component: 'HiddenQRCode',
        subContext: context,
        valueLength: value.length,
      },
    });

    onError?.(error);
    return errorDetails;
  }, [value, onError]);

  const generateWebQRCode = useCallback(async () => {
    if (value.length > MAX_QR_VALUE_LENGTH) {
      handleError(
        new Error(`Valeur QR code trop longue (${value.length}/${MAX_QR_VALUE_LENGTH})`),
        'web_validation'
      );
      return;
    }

    try {
      const QRCode = await import('qrcode');
      const dataUrl = await QRCode.toDataURL(value, { 
        width: QR_CODE_SIZE, 
        margin: 0,
      });
      onCapture(dataUrl.split(',')[1]);
    } catch (err) {
      handleError(err as Error, 'web_generation');
    }
  }, [value, onCapture, handleError]);

  const captureMobileQRCode = useCallback(async () => {
    if (!viewShotRef.current?.capture) {
      handleError(
        new Error('Composant ViewShot non initialisé'),
        'mobile_ref'
      );
      return;
    }

    try {
      const base64 = await viewShotRef.current.capture();
      onCapture(base64);
    } catch (err) {
      handleError(err as Error, 'mobile_capture');
    }
  }, [onCapture, handleError]);

  useEffect(() => {
    if (value.length > MAX_QR_VALUE_LENGTH) {
      handleError(
        new Error(`Valeur QR code trop longue (${value.length}/${MAX_QR_VALUE_LENGTH})`),
        'validation'
      );
      return;
    }

    if (Platform.OS === 'web') {
      generateWebQRCode();
    } else {
      const timer = setTimeout(captureMobileQRCode, CAPTURE_DELAY);
      return () => clearTimeout(timer);
    }
  }, [value, generateWebQRCode, captureMobileQRCode, handleError]);

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <View style={{ position: 'absolute', top: -1000, left: -1000 }}>
      <ViewShot
        ref={viewShotRef}
        options={{ 
          format: 'png',
          result: 'base64',
          quality: 0.8
        }}
      >
        <QRCode 
          value={value} 
          size={QR_CODE_SIZE}
        />
      </ViewShot>
    </View>
  );
});

HiddenQRCode.displayName = 'HiddenQRCode'; 