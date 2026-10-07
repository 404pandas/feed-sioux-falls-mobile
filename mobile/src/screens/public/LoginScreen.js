import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { BrandMark, TextLink } from '../../components/Brand';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { brand, colors, inputStyle, liftSmall, radii, spacing, typography } from '../../theme/tokens';
import Lift from '../../components/Lift';

const ROLE_ORDER = { admin: 0, volunteer: 1, neighbor: 2 };
const ROLE_LABEL = { admin: 'Admin', volunteer: 'Volunteer', neighbor: 'Neighbor' };

// Staff & volunteer log in - the website's /login page. The list of names
// only shows up here, never on the public screens. Tap your name, type
// your PIN.
export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [names, setNames] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pinRef = useRef(null);

  function loadNames() {
    setLoadFailed(false);
    api
      .getNames()
      .then((list) => setNames([...list].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name))))
      .catch(() => setLoadFailed(true));
  }

  useEffect(loadNames, []);

  async function handleLogin() {
    if (!selected || pin.length < 4) return;
    setLoading(true);
    setError('');
    try {
      await login(selected._id, pin);
      // The root navigator sees the new user and shows the right home.
    } catch (err) {
      setError(err.message);
      setPin('');
      pinRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={{ marginBottom: 20, marginTop: spacing.sm }}>
        <BrandMark size={26} imageHeight={52} />
      </View>

      <Card style={{ padding: spacing.lg }}>
        <Text style={typography.h1} accessibilityRole="header">
          Staff & volunteer log in
        </Text>
        <Text style={[typography.body, { marginTop: 6, marginBottom: spacing.md }]}>Tap your name, then type your PIN.</Text>

        {loadFailed && (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={styles.error}>Couldn't load the list of names. Check your internet connection.</Text>
            <Button title="Try again" variant="outline" small onPress={loadNames} style={{ alignSelf: 'flex-start', marginTop: spacing.sm }} />
          </View>
        )}
        {!names && !loadFailed && <Text style={typography.bodyMuted}>Loading names…</Text>}

        {names?.map((u) => {
          const on = selected?._id === u._id;
          return (
            <Pressable
              key={u._id}
              onPress={() => {
                setSelected(u);
                setPin('');
                setError('');
                setTimeout(() => pinRef.current?.focus(), 50);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${u.name}, ${ROLE_LABEL[u.role] || u.role}`}
              style={{ marginBottom: spacing.sm }}
            >
              <Lift
                offset={on ? liftSmall : 0}
                radius={radii.md}
                style={[styles.nameOption, on && { backgroundColor: brand.teal }]}
              >
                <Text style={[styles.name, on && { color: colors.white }]}>{u.name}</Text>
                <View style={[styles.rolePill, on && { borderColor: colors.white }]}>
                  <Text style={[styles.role, on && { color: colors.white }]}>{ROLE_LABEL[u.role] || u.role}</Text>
                </View>
              </Lift>
            </Pressable>
          );
        })}

        {selected && (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={[typography.label, { marginBottom: spacing.xs }]}>PIN for {selected.name.split(' ')[0]}</Text>
            <TextInput
              ref={pinRef}
              value={pin}
              onChangeText={(v) => setPin(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              style={styles.pinInput}
              placeholder="••••"
              onSubmitEditing={handleLogin}
              returnKeyType="go"
              accessibilityLabel={`PIN for ${selected.name}`}
            />
            {!!error && (
              <Text style={[styles.error, { marginTop: spacing.sm }]} accessibilityRole="alert">
                {error}
              </Text>
            )}
            <Button title="Log in" onPress={handleLogin} loading={loading} disabled={pin.length < 4} style={{ marginTop: spacing.md }} />
          </View>
        )}
      </Card>

      <TextLink title="Back to the website" icon="chevronLeft" onPress={() => navigation.goBack()} style={{ marginTop: 20 }} />

      {/* So you can tell at a glance which build is installed. */}
      <Text style={[typography.bodyMuted, { textAlign: 'center', marginTop: 'auto', paddingTop: spacing.lg }]}>
        Version {Constants.expoConfig?.version}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nameOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 60,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: brand.ink,
    borderRadius: radii.md,
    backgroundColor: brand.paper,
  },
  name: { fontSize: 19, fontWeight: '700', flexShrink: 1, marginRight: spacing.sm },
  rolePill: { borderWidth: 2, borderColor: brand.ink, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 2 },
  role: { fontSize: 15, fontWeight: '700' },
  pinInput: { ...inputStyle, fontSize: 32, letterSpacing: 12, textAlign: 'center' },
  error: { color: colors.danger, fontWeight: '700' },
});
