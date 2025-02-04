import React, { useRef, useEffect } from 'react';
import { View } from 'react-native';
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
  const viewShotRef = useRef<ViewShotType>(null);

  useEffect(() => {
    // On attend un court délai pour s'assurer que le QR code est bien rendu
    const timer = setTimeout(() => {
      if (viewShotRef.current) {
        viewShotRef.current
          .capture()
          .then((data: string) => {
            onCapture(data);
          })
          .catch((error) => {
            console.error('Erreur lors de la capture du QR code', error);
          });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [value, onCapture]);

  return (
    <View style={{ position: 'absolute', top: -1000, left: -1000 }}>
      <ViewShot
        ref={viewShotRef as React.RefObject<ViewShot>}
        options={{ format: 'png', result: 'base64', width: 150, height: 150 }}
      >
        <QRCode value={value} size={150} backgroundColor="white" color="black" />
      </ViewShot>
    </View>
  );
}; 