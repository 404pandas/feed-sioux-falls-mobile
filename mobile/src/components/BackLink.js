import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Text from './Text';
import { colors, spacing } from '../theme/tokens';

// The website's "← Home" pill. The header's back arrow does the same
// thing, but this one is big, labeled, and where people look first.
export default function BackLink({ label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.text}>← {label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 999,
  },
  text: { fontSize: 16, fontWeight: '600', color: colors.primary },
});
