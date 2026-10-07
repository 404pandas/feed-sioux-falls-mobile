import React from 'react';
import Lift, { splitStyle } from './Lift';
import { cardStyle, lift, radii } from '../theme/tokens';

// White, outlined, rounded, with the hard ink shadow - the website's .card.
// flat: no shadow (for cards inside cards).
export default function Card({ children, style, flat }) {
  const { outer, inner } = splitStyle([cardStyle, style]);
  return (
    <Lift offset={flat ? 0 : lift} radius={inner.borderRadius ?? radii.lg} outerStyle={outer} style={inner}>
      {children}
    </Lift>
  );
}
