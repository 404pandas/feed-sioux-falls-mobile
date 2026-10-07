import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { brand } from '../theme/tokens';

// The website's line icons (src/components/Icon.jsx), same paths, so both
// look alike. Decorative - always pair with a text label.
const PATHS = {
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5M10 20v-5.5h4V20',
  counter: 'M8 7a3 3 0 1 0 0-.01M3 20c0-3 2.4-5.5 5-5.5s5 2.5 5 5.5M16 8h5M18.5 5.5v5M15 20c0-2 1-3.6 2.6-4.5',
  box: 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9',
  clipboard: 'M9 4h6v3H9zM7 5.5H5.5V21h13V5.5H17M8.5 11h7M8.5 14.5h7M8.5 18h4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5H5V6h5',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z',
  chart: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6',
  wallet: 'M4 7h14a2 2 0 0 1 2 2v9H4zM4 7l11-3v3M16 13h.01',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  mail: 'M3.5 6h17v12h-17zM3.5 6 12 13l8.5-7',
  people: 'M9 8a3 3 0 1 0 0-.01M3.5 20c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5M16 6.5a2.5 2.5 0 1 1 0 5M17.5 14.6c1.8.6 3 2.4 3 4.9',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  pin: 'M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  phone: 'M6 3h3l1.5 4.5L8 9a11 11 0 0 0 7 7l1.5-2.5L21 15v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  history: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2',
};

export default function Icon({ name, size = 22, color = brand.ink, strokeWidth = 2.2, style }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
