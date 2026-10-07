import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/tokens';

// Every screen's outer wrapper.
//
// scroll (default true): content scrolls, and on iOS the scroll view moves
// itself out of the keyboard's way so the field being typed in (and the
// Save button under it) never ends up hidden behind the keyboard. Android
// does this by resizing the window, which Expo turns on by default.
//
// keyboardShouldPersistTaps="handled" fixes the "tap Save twice" problem:
// without it, the first tap on a button while the keyboard is open only
// closes the keyboard.
//
// scroll={false} is for screens that put their own FlatList inside.
export default function Screen({ children, scroll = true, refreshControl, edges = ['bottom'] }) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  // flexGrow lets short screens still fill the height (so layouts that
  // spread things out with space-between keep working) while tall screens
  // scroll instead of getting cut off.
  scrollContent: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl },
  content: { flex: 1, padding: spacing.lg },
});
