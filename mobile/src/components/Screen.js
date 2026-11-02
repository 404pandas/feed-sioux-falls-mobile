import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView, useKeyboardState } from 'react-native-keyboard-controller';
import { colors, spacing } from '../theme/tokens';

// Space kept between the field being typed in and the top of the keyboard:
// enough that the Save/Send button under a field usually shows too.
const KEYBOARD_GAP = 96;

// Every screen's outer wrapper.
//
// scroll (default true): content scrolls, and when the keyboard opens the
// field being typed in is scrolled into view above it, with room left to
// scroll on down to the Save/Send button under it. Android 15+ draws apps
// edge to edge and no longer shrinks the screen for the keyboard, so this
// is done here (react-native-keyboard-controller) instead of by Android.
//
// keyboardShouldPersistTaps="handled" fixes the "tap Save twice" problem:
// without it, the first tap on a button while the keyboard is open only
// closes the keyboard.
//
// scroll={false} is for screens that put their own FlatList inside; the
// screen gets bottom padding the height of the keyboard instead, so a
// compose box at the bottom (Messages, Team chat) stays above it.
function KeyboardPadded({ children }) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardState((state) => (state.isVisible ? state.height : 0));
  // The safe area already keeps the bottom inset clear; the keyboard covers it too.
  return <View style={[styles.inner, { paddingBottom: styles.inner.padding + Math.max(0, keyboard - insets.bottom) }]}>{children}</View>;
}
// padded={false} is for the public screens, whose colored bands run edge
// to edge like the website's.
export default function Screen({ children, scroll = true, padded = true, refreshControl, edges = ['bottom'], scrollRef }) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {scroll ? (
        <KeyboardAwareScrollView
          ref={scrollRef}
          contentContainerStyle={padded ? styles.scrollContent : styles.flush}
          keyboardShouldPersistTaps="handled"
          bottomOffset={KEYBOARD_GAP}
          refreshControl={refreshControl}
        >
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <KeyboardPadded>{children}</KeyboardPadded>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  // flexGrow lets short screens still fill the height (so layouts that
  // spread things out with space-between keep working) while tall screens
  // scroll instead of getting cut off.
  scrollContent: { flexGrow: 1, padding: 20, paddingBottom: spacing.xxl },
  inner: { flex: 1, padding: spacing.lg },
  flush: { flexGrow: 1 },
});
