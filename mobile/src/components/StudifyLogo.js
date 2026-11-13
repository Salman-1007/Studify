import React, { useState } from 'react';
import { Image, View, Text } from 'react-native';

export default function StudifyLogo({ size = 40, style }) {
  const [loadError, setLoadError] = useState(false);

  if (loadError) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.28),
            backgroundColor: '#863bff',
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ]}
      >
        <Text style={{ color: '#FFFFFF', fontSize: Math.round(size * 0.55), fontWeight: '900' }}>
          S
        </Text>
      </View>
    );
  }

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Image
        source={require('../../assets/adaptive-icon.png')}
        onError={() => setLoadError(true)}
        style={{ width: size, height: size, resizeMode: 'contain' }}
      />
    </View>
  );
}
