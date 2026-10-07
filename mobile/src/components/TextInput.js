import React, { forwardRef } from 'react';
import { TextInput as RNTextInput } from 'react-native';
import { resolveFont } from './Text';
import { colors } from '../theme/tokens';

// Text fields get the body font too (and a readable placeholder color).
const TextInput = forwardRef(function TextInput({ style, ...props }, ref) {
  return <RNTextInput ref={ref} placeholderTextColor="#8A837C" {...props} style={resolveFont([{ color: colors.text }, style])} />;
});

export default TextInput;
