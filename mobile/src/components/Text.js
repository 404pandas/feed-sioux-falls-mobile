import React from 'react';
import { Text as RNText, StyleSheet, PixelRatio } from 'react-native';
import { colors, fonts } from '../theme/tokens';

function isBold(weight) {
  return weight === 'bold' || Number(weight) >= 600;
}

// The app's Text: Atkinson Hyperlegible by default, Fredoka when a style
// asks for fontFamily 'display' (headings, buttons). Custom fonts on
// Android need a separate file per weight, so fontWeight is turned into
// the matching font file here instead of being passed through.
//
// Line heights are scaled with the phone's text size too: React Native grows
// the letters but not a fixed lineHeight, so at large text sizes lines would
// overlap and get cut off ("Good mornina").
export function resolveFont(style, maxFontSizeMultiplier) {
  const flat = StyleSheet.flatten(style) || {};
  const { fontFamily, fontWeight } = flat;
  let family = fontFamily;
  if (!family || family === 'body') family = isBold(fontWeight) ? fonts.bodyBold : fonts.body;
  else if (family === 'display') family = isBold(fontWeight) ? fonts.display : fonts.displayMedium;
  const out = { ...flat, fontFamily: family, fontWeight: undefined };
  const scale = Math.min(PixelRatio.getFontScale(), maxFontSizeMultiplier || Infinity);
  if (out.lineHeight && scale > 1) out.lineHeight = Math.round(out.lineHeight * scale);
  return out;
}

export default function Text({ style, ...props }) {
  return <RNText {...props} style={resolveFont([styles.base, style], props.maxFontSizeMultiplier)} />;
}

const styles = StyleSheet.create({
  base: { color: colors.text, fontSize: 18 },
});
