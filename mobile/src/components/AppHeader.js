import React from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from './Text';
import Icon from './Icon';
import { BrandMark } from './Brand';
import { brand } from '../theme/tokens';

// Every screen's header, drawn like the website's: white, a 2px ink rule
// underneath, the heart-hand logo, and a labeled Back button (not just an
// arrow). Used for both stack and tab screens via `header: AppHeader`.
//
// Screen options it reads:
//   title          - shown when not showing the brand
//   headerBrand    - true: show "Feed Sioux Falls" with the logo instead
//   headerTone     - 'teal' for the survey (like the website's survey bar)
//   headerRight    - () => element
//   headerBackLabel - text for the back button (default "Back")
// The header is one row (back, title, a button), so its text grows with the
// phone's text size only up to this much; the screen below grows fully.
export const HEADER_MAX_SCALE = 1.3;

export default function AppHeader({ navigation, options, back }) {
  const insets = useSafeAreaInsets();
  const teal = options.headerTone === 'teal';
  const fg = teal ? brand.paper : brand.ink;
  const canGoBack = !!back;

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: teal ? brand.teal : brand.paper,
        borderBottomWidth: 2,
        borderBottomColor: brand.ink,
      }}
    >
      <View style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
        {canGoBack && (
          <Pressable
            onPress={navigation.goBack}
            accessibilityRole="button"
            accessibilityLabel={options.headerBackLabel || 'Back'}
            hitSlop={10}
            style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, marginRight: 8 }}
          >
            <Icon name="chevronLeft" size={24} color={fg} />
            <Text style={{ fontWeight: '700', color: fg, fontSize: 17 }} maxFontSizeMultiplier={HEADER_MAX_SCALE}>
              {options.headerBackLabel || 'Back'}
            </Text>
          </Pressable>
        )}
        <View style={{ flex: 1, alignItems: canGoBack ? 'center' : 'flex-start' }}>
          {options.headerBrand && !canGoBack ? (
            <BrandMark maxFontSizeMultiplier={HEADER_MAX_SCALE} />
          ) : (
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={HEADER_MAX_SCALE}
              accessibilityRole="header"
              style={{ fontFamily: 'display', fontWeight: '600', fontSize: 20, color: fg }}
            >
              {options.title}
            </Text>
          )}
        </View>
        <View style={{ minWidth: canGoBack ? 64 : 0, alignItems: 'flex-end' }}>{options.headerRight?.()}</View>
      </View>
    </View>
  );
}
