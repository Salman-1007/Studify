import React from 'react';
import { Image, View } from 'react-native';

export default function StudifyLogo({ size = 40, style }) {
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Image
        source={require('../../assets/adaptive-icon.png')}
        style={{ width: size, height: size, resizeMode: 'contain' }}
      />
    </View>
  );
}
