import React from 'react';
import { View, Image, Pressable, useWindowDimensions } from 'react-native';
import Text from './Text';
import Icon from './Icon';
import { brand, colors, radii, spacing, typography } from '../theme/tokens';

// Small pieces of the website's look (src/theme/brand.css), for React Native.

export const ART = {
  hands: { src: require('../../assets/brand/hands.png'), ratio: 529 / 228 },
  logo: { src: require('../../assets/brand/logo-full.png'), ratio: 540 / 298 },
  heart: { src: require('../../assets/brand/heart.png'), ratio: 72 / 226 },
  shirt: { src: require('../../assets/brand/shirt.png'), ratio: 176 / 190 },
  can: { src: require('../../assets/brand/can.png'), ratio: 84 / 214 },
  bear: { src: require('../../assets/brand/bear.png'), ratio: 99 / 213 },
  jar: { src: require('../../assets/brand/jar.png'), ratio: 87 / 210 },
};

// One hand from the logo, as a small marker beside a section heading.
export function Mascot({ name, height = 92, style }) {
  const art = ART[name];
  return (
    <Image
      source={art.src}
      style={[{ height, width: height * art.ratio }, style]}
      resizeMode="contain"
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

// The full row of raised hands. Sized from the screen width (minus
// `inset`, the horizontal space around it) so the box is exactly the
// drawing - otherwise it floats with empty space above and below.
export function HandsArt({ style, inset = 40 }) {
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(560, screenWidth - inset);
  return (
    <Image
      source={ART.hands.src}
      style={[{ width, height: width / ART.hands.ratio, alignSelf: 'center' }, style]}
      resizeMode="contain"
      accessibilityLabel="Five raised hands holding a teddy bear, a jar of coins, a heart, a T-shirt, and a can of food"
    />
  );
}

// "Feed Sioux Falls" with the heart hand - the website's header brand.
export function BrandMark({ size = 22, imageHeight = 40 }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Mascot name="heart" height={imageHeight} style={{ marginRight: 8 }} />
      <Text style={{ fontFamily: 'display', fontWeight: '600', fontSize: size, color: brand.ink }}>Feed Sioux Falls</Text>
    </View>
  );
}

const PILL = {
  ok: { bg: brand.tealSoft, fg: '#0F4A43' },
  low: { bg: brand.coinSoft, fg: '#6A4B00' },
  out: { bg: brand.heartSoft, fg: '#8C1233' },
  plain: { bg: brand.paper, fg: brand.ink },
};

export function Pill({ label, tone = 'plain', icon, style }) {
  const t = PILL[tone] || PILL.plain;
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          paddingHorizontal: 12,
          paddingVertical: 2,
          borderWidth: 2,
          borderColor: brand.ink,
          borderRadius: radii.pill,
          backgroundColor: t.bg,
        },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={16} color={t.fg} style={{ marginRight: 4 }} />}
      <Text style={{ fontSize: 15, fontWeight: '700', color: t.fg }}>{label}</Text>
    </View>
  );
}

// Yellow highlighter behind live numbers, like coins in the jar.
export function Mark({ children }) {
  return <Text style={{ backgroundColor: brand.coin, fontWeight: '700' }}>{children}</Text>;
}

// A full-width section with the website's band colors and ink divider.
// tone: 'mist' (page background) | 'white' | 'coin' | 'teal' | 'heart'
const BAND = { mist: brand.mist, white: brand.paper, coin: brand.coinSoft, teal: brand.tealSoft, heart: brand.heartSoft };
export function Band({ tone = 'mist', children, style }) {
  return (
    <View
      style={[
        { backgroundColor: BAND[tone], paddingVertical: 40, paddingHorizontal: 20, borderBottomWidth: 2, borderBottomColor: brand.ink },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// Heading with a hand mascot beside it.
export function SectionHead({ title, sub, mascot }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.lg }}>
      {mascot && <Mascot name={mascot} style={{ marginRight: spacing.md }} />}
      <View style={{ flex: 1 }}>
        <Text style={[typography.h1, { marginBottom: sub ? 6 : 0 }]} accessibilityRole="header">
          {title}
        </Text>
        {!!sub && <Text style={typography.body}>{sub}</Text>}
      </View>
    </View>
  );
}

// Big page title on white, like the website's .page-title-band.
export function PageTitle({ title, lede, mascot }) {
  return (
    <View
      style={{
        backgroundColor: brand.paper,
        borderBottomWidth: 2,
        borderBottomColor: brand.ink,
        paddingHorizontal: 20,
        paddingTop: 32,
        paddingBottom: 28,
        flexDirection: 'row',
        alignItems: 'flex-end',
      }}
    >
      <View style={{ flex: 1, marginRight: mascot ? spacing.md : 0 }}>
        <Text style={[typography.h1, { fontSize: 38, lineHeight: 44 }]} accessibilityRole="header">
          {title}
        </Text>
        {!!lede && <Text style={[typography.body, { fontSize: 19, marginTop: spacing.sm }]}>{lede}</Text>}
      </View>
      {mascot && <Mascot name={mascot} height={110} />}
    </View>
  );
}

export function EmptyNote({ children }) {
  return (
    <View
      style={{
        padding: spacing.lg,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#B9B2AA',
        borderRadius: radii.lg,
      }}
    >
      <Text style={[typography.body, { textAlign: 'center', color: colors.textMuted }]}>{children}</Text>
    </View>
  );
}

// Bold teal link with a chevron, like the website's .text-link.
export function TextLink({ title, onPress, icon = 'chevronRight', style }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8} style={[{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }, style]}>
      {icon === 'chevronLeft' && <Icon name="chevronLeft" size={20} color={brand.teal} style={{ marginRight: 4 }} />}
      <Text style={{ color: brand.teal, fontWeight: '700', textDecorationLine: 'underline' }}>{title}</Text>
      {icon === 'chevronRight' && <Icon name="chevronRight" size={20} color={brand.teal} style={{ marginLeft: 4 }} />}
    </Pressable>
  );
}
