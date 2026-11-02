import React, { useCallback, useState } from 'react';
import { View, Pressable, Switch, Linking, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Text from '../../components/Text';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { KINDS, loadPrefs, syncNotifications, updatePrefs } from '../../notifications';
import { brand, colors, spacing, typography } from '../../theme/tokens';

function SwitchRow({ label, sub, value, onChange, disabled }) {
  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
      style={[styles.row, disabled && { opacity: 0.5 }]}
    >
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <Text style={{ fontWeight: '700' }}>{label}</Text>
        {!!sub && <Text style={typography.bodyMuted}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: brand.teal, false: '#BDB7AF' }}
        thumbColor={colors.white}
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

// Everyone's notification switches - one per kind, plus privacy mode.
// Nothing is turned on until someone turns it on here (staff are asked once
// after logging in).
export default function NotificationSettingsScreen() {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'volunteer';
  const [state, setState] = useState(null); // result of syncNotifications
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      loadPrefs().then((prefs) => live && setState((s) => s || { prefs }));
      syncNotifications().then((r) => live && setState(r));
      return () => {
        live = false;
      };
    }, [])
  );

  async function change(update) {
    // Show the switch moving right away; the phone and server catch up.
    setState((s) => ({ ...s, prefs: { ...s.prefs, ...update, kinds: { ...s.prefs.kinds, ...(update.kinds || {}) } } }));
    setBusy(true);
    setState(await updatePrefs(update));
    setBusy(false);
  }

  if (!state) {
    return (
      <Screen>
        <Text style={typography.body}>Loading…</Text>
      </Screen>
    );
  }

  const { prefs, permission, pushReady, error } = state;
  const blocked = permission === 'blocked';
  const kinds = KINDS.filter((k) => isStaff || !k.staffOnly);

  return (
    <Screen>
      <Text style={typography.h1} accessibilityRole="header">
        Notifications
      </Text>
      <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        Choose what this phone gets. You can change this any time.
      </Text>

      <Card style={{ marginBottom: spacing.lg }}>
        <SwitchRow
          label="Notifications on"
          sub="Let this phone get notifications from Feed Sioux Falls."
          value={prefs.enabled && !blocked}
          onChange={(on) => change({ enabled: on })}
          disabled={busy || blocked}
        />
        {blocked && (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={typography.body}>Notifications are turned off for this app in your phone's settings.</Text>
            <Button title="Open phone settings" variant="outline" small onPress={() => Linking.openSettings()} style={{ alignSelf: 'flex-start', marginTop: spacing.sm }} />
          </View>
        )}
        {prefs.enabled && !blocked && !pushReady && !!error && (
          <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>
            The Saturday reminder works. Other notifications can't reach this phone right now - usually no signal. It will
            try again next time the app opens.
          </Text>
        )}
      </Card>

      {prefs.enabled && !blocked && (
        <>
          <Text style={[typography.h2, { marginBottom: spacing.sm }]}>What to get</Text>
          <Card style={{ marginBottom: spacing.lg }}>
            {kinds.map((k, i) => (
              <View key={k.key} style={i > 0 && styles.divider}>
                <SwitchRow
                  label={k.label}
                  sub={k.sub}
                  value={prefs.kinds[k.key]}
                  onChange={(on) => change({ kinds: { [k.key]: on } })}
                />
              </View>
            ))}
          </Card>

          <Text style={[typography.h2, { marginBottom: spacing.sm }]}>Privacy</Text>
          <Card style={{ marginBottom: spacing.lg }}>
            <SwitchRow
              label="Hide what notifications say"
              sub={'Notifications only say "You have a new update", and never show on the lock screen.'}
              value={prefs.hideContent}
              onChange={(on) => change({ hideContent: on })}
            />
            <Text style={[typography.bodyMuted, { marginTop: spacing.md }]}>
              Good to know: Android always shows which app a notification came from, and the Feed Sioux Falls icon is on
              your home screen. Even with this on, someone who picks up your phone can tell you have the app.
            </Text>
          </Card>
        </>
      )}

      <Button
        title="Phone's notification settings"
        icon="bell"
        variant="outline"
        onPress={() => Linking.openSettings()}
        style={{ alignSelf: 'flex-start' }}
      />
      <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>
        Each kind above is also listed there, so you can change its sound or turn it off.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: brand.line },
});
