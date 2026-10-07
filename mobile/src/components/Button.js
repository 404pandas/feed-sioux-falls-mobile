import React from 'react';
import { Pressable, ActivityIndicator, View } from 'react-native';
import Text from './Text';
import Icon from './Icon';
import Lift, { splitStyle } from './Lift';
import { brand, colors, liftSmall, radii, spacing } from '../theme/tokens';

// Same buttons as the website: pill-shaped, marker outline, small hard
// shadow that the button presses into.
// variant: 'primary' (jar teal) | 'accent' (heart pink - giving) | 'coin'
//          (yellow) | 'outline' | 'outline-danger' | 'outline-success'
const VARIANTS = {
  primary: { bg: brand.teal, fg: colors.white },
  accent: { bg: brand.heart, fg: colors.white },
  coin: { bg: brand.coin, fg: brand.ink },
  outline: { bg: brand.paper, fg: brand.ink },
  'outline-danger': { bg: brand.paper, fg: colors.danger },
  'outline-success': { bg: brand.paper, fg: colors.success },
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  small,
  icon,
  iconRight,
  style,
  textColor: textColorOverride,
  accessibilityLabel,
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const fg = textColorOverride || v.fg;
  const { outer, inner } = splitStyle(style);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={[outer, isDisabled && { opacity: 0.5 }]}
    >
      {({ pressed }) => (
        <Lift
          offset={liftSmall}
          radius={radii.pill}
          pressed={pressed && !isDisabled}
          style={[
            {
              minHeight: small ? 44 : 52,
              paddingVertical: small ? 6 : 12,
              paddingHorizontal: small ? spacing.md : spacing.lg,
              borderRadius: radii.pill,
              borderWidth: 2,
              borderColor: brand.ink,
              backgroundColor: v.bg,
              alignItems: 'center',
              justifyContent: 'center',
            },
            inner,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={fg} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              {icon && <Icon name={icon} size={small ? 18 : 20} color={fg} style={{ marginRight: 8 }} />}
              <Text
                style={{ fontFamily: 'display', fontWeight: '600', fontSize: small ? 16 : 19, color: fg, textAlign: 'center' }}
              >
                {title}
              </Text>
              {iconRight && <Icon name={iconRight} size={small ? 18 : 20} color={fg} style={{ marginLeft: 8 }} />}
            </View>
          )}
        </Lift>
      )}
    </Pressable>
  );
}
