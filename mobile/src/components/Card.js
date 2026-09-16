import React from 'react';
import { View } from 'react-native';
import { cardStyle } from '../theme/tokens';

export default function Card({ children, style }) {
  return <View style={[cardStyle, style]}>{children}</View>;
}
