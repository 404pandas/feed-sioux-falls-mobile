import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';

// variant: 'primary' (forest green) | 'accent' (pumpkin - the one CTA color)
//          | 'outline' (bordered, no fill)
export default function Button({ title, onPress, variant = 'primary', disabled, loading, style }) {
  const backgroundColor = {
    primary: colors.primary,
    accent: colors.accent,
    outline: 'transparent',
  }[variant];

  const textColor = variant === 'outline' ? colors.primary : colors.white;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor, opacity: pressed ? 0.85 : disabled ? 0.5 : 1 },
        variant === 'outline' && { borderWidth: 1, borderColor: colors.primary },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[typography.button, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52, // tactile tap target for field use
  },
});
