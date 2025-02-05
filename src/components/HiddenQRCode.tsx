import React, { useRef, useEffect } from 'react';
import { View, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';

interface HiddenQRCodeProps {
  value: string;
  onCapture: (data: string) => void;
}

interface ViewShotType {
  capture: () => Promise<string>;
}

export const HiddenQRCode: React.FC<HiddenQRCodeProps> = ({ value, onCapture }) => {
  const viewShotRef = useRef<ViewShot>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Sur le web, utilisez une autre approche pour générer le QR code
      const generateQRBase64 = async () => {
        const QRCode = await import('qrcode');
        try {
          const dataUrl = await QRCode.toDataURL(value, { width: 150, margin: 0 });
          onCapture(dataUrl.split(',')[1]); // Retourne seulement le base64
        } catch (err) {
          console.error('Erreur génération QR code web:', err);
        }
      };
      generateQRBase64();
    } else {
      // Code existant pour mobile
      const timer = setTimeout(() => {
        if (viewShotRef?.current?.capture) {
          viewShotRef.current
            .capture()
            .then(onCapture)
            .catch(console.error);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [value, onCapture]);

  if (Platform.OS === 'web') {
    return null; // Pas besoin de rendu sur le web
  }

  return (
    <View style={{ position: 'absolute', top: -1000, left: -1000 }}>
      <ViewShot
        ref={viewShotRef}
        options={{ format: 'png', result: 'base64' }}
      >
        <QRCode value={value} size={150} />
      </ViewShot>
    </View>
  );
}; 