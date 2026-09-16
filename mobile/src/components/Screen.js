import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/tokens';

export default function Screen({ children, scroll = true }) {
  const Container = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Container contentContainerStyle={scroll ? styles.scrollContent : styles.content} style={scroll ? undefined : styles.content}>
        {children}
      </Container>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  content: { flex: 1, padding: spacing.lg },
});
