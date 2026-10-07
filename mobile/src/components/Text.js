import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme/tokens';

function isBold(weight) {
  return weight === 'bold' || Number(weight) >= 600;
}

// The app's Text: Atkinson Hyperlegible by default, Fredoka when a style
// asks for fontFamily 'display' (headings, buttons). Custom fonts on
// Android need a separate file per weight, so fontWeight is turned into
// the matching font file here instead of being passed through.
export function resolveFont(style) {
  const flat = StyleSheet.flatten(style) || {};
  const { fontFamily, fontWeight } = flat;
  let family = fontFamily;
  if (!family || family === 'body') family = isBold(fontWeight) ? fonts.bodyBold : fonts.body;
  else if (family === 'display') family = isBold(fontWeight) ? fonts.display : fonts.displayMedium;
  return { ...flat, fontFamily: family, fontWeight: undefined };
}

export default function Text({ style, ...props }) {
  return <RNText {...props} style={resolveFont([styles.base, style])} />;
}

const styles = StyleSheet.create({
  base: { color: colors.text, fontSize: 18 },
});
