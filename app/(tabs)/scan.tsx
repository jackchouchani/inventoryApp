import React from 'react';
import { View } from 'react-native';
import { ScanScreen } from '../../src/screens/ScanScreen';

export default function Scan() {
  return (
    <View style={{ flex: 1 }}>
      <ScanScreen />
    </View>
  );
}