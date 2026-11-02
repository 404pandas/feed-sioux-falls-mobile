import React, { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import Text from './Text';
import Button from './Button';
import { brand, radii, spacing } from '../theme/tokens';

// Over-the-air updates: when a new version of the app's screens has been
// published (npm run update), it downloads in the background and this note
// asks to restart - so nobody stays on an old version for weeks. Restarting
// takes a second and keeps the login, the offline queue, and survey drafts.
//
// Checks when the app opens and whenever it comes back to the front, at
// most every 15 minutes. Does nothing in development or Expo Go.
const CHECK_EVERY_MS = 15 * 60 * 1000;

export default function UpdateBanner() {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return undefined;

    async function check() {
      if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
      lastCheck.current = Date.now();
      try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (!isAvailable) return;
        const { isNew } = await Updates.fetchUpdateAsync();
        if (isNew !== false) setReady(true);
      } catch {
        // No signal - try again next time the app comes to the front.
        lastCheck.current = 0;
      }
    }

    check();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => sub.remove();
  }, []);

  if (!ready || dismissed) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: spacing.md,
        right: spacing.md,
        bottom: insets.bottom + 84,
        padding: spacing.md,
        backgroundColor: brand.coinSoft,
        borderWidth: 2,
        borderColor: brand.ink,
        borderRadius: radii.lg,
      }}
    >
      <Text style={{ fontWeight: '700', marginBottom: spacing.sm }}>A new version is ready.</Text>
      <View style={{ flexDirection: 'row' }}>
        <Button title="Restart now" small onPress={() => Updates.reloadAsync()} style={{ marginRight: spacing.sm }} />
        <Button title="Later" small variant="outline" onPress={() => setDismissed(true)} />
      </View>
    </View>
  );
}

// "3.0.0" or "3.0.0 · updated Nov 2" - shown on the login screen so you can
// tell at a glance what a phone is running.
export function versionLabel(version) {
  if (Updates.isEnabled && !Updates.isEmbeddedLaunch && Updates.createdAt) {
    return `${version} · updated ${Updates.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return version;
}
