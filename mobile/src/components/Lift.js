import React from 'react';
import { View, StyleSheet } from 'react-native';
import { brand } from '../theme/tokens';

// Style keys that position the whole sticker (go on the outer wrapper);
// everything else styles the face.
const OUTER_KEYS = new Set([
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'maxWidth', 'minWidth',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'position', 'top', 'bottom', 'left', 'right', 'zIndex',
]);

export function splitStyle(style) {
  const flat = StyleSheet.flatten(style) || {};
  const outer = {};
  const inner = {};
  for (const [k, v] of Object.entries(flat)) (OUTER_KEYS.has(k) ? outer : inner)[k] = v;
  return { outer, inner };
}

// The website's "cut out of the drawing" look: a solid ink shadow offset
// down and right, no blur. React Native's shadows are blurry (and Android
// only has elevation), so it's drawn as a second shape behind the face.
// `pressed` pushes the face into the shadow, like the website's buttons.
export default function Lift({ offset = 3, radius = 18, pressed, outerStyle, style, children, shadowColor = brand.ink }) {
  return (
    <View style={[{ paddingRight: offset, paddingBottom: offset }, outerStyle]}>
      {offset > 0 && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: offset, left: offset, right: 0, bottom: 0, borderRadius: radius, backgroundColor: shadowColor }}
        />
      )}
      <View style={[{ borderRadius: radius }, style, pressed && { transform: [{ translateX: offset }, { translateY: offset }] }]}>
        {children}
      </View>
    </View>
  );
}
