import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import Constants from 'expo-constants';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import Card from '../../components/Card';
import SurveyInvite from '../../components/SurveyInvite';
import { colors, spacing, typography, radii } from '../../theme/tokens';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function LandingScreen({ navigation }) {
  const { login } = useAuth();
  const [names, setNames] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const [namesError, setNamesError] = useState(false);

  function loadNames() {
    setNamesError(false);
    api
      .getNames()
      .then(setNames)
      .catch(() => {
        setNames([]);
        setNamesError(true);
      });
  }

  useEffect(loadNames, []);

  async function handleLogin() {
    if (!selectedUser || !pin) return;
    setLoading(true);
    try {
      await login(selectedUser._id, pin);
      // Navigation happens automatically via the root navigator watching auth state.
    } catch (err) {
      Alert.alert('Login failed', err.message);
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={typography.h1}>Feed Sioux Falls</Text>
      <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        Bridging people who have a little extra with people who need a little extra.
      </Text>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h2, { marginBottom: spacing.sm }]}>Welcome!</Text>
        <Text style={[typography.body, { marginBottom: spacing.sm }]}>
          <Text style={{ fontWeight: '700' }}>Neighbors, volunteers, and admins with an account:</Text> pick your name
          below and enter your PIN.
        </Text>
        <Text style={[typography.body, { marginBottom: spacing.md }]}>
          <Text style={{ fontWeight: '700' }}>Everyone else:</Text> no account needed - tap Continue as Guest to donate,
          get in touch, or see what's available.
        </Text>
        <Button title="Continue as Guest" variant="outline" onPress={() => navigation.navigate('GuestHome')} />
      </Card>

      <SurveyInvite />

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h2, { marginBottom: spacing.md }]}>Log In</Text>

        <Text style={[typography.bodyMuted, { marginBottom: spacing.sm }]}>Select your name</Text>
        {namesError && (
          <View style={{ marginBottom: spacing.sm }}>
            <Text style={[typography.body, { marginBottom: spacing.sm }]}>
              Couldn't load the volunteer list. Check your connection.
            </Text>
            <Button title="Try Again" variant="outline" onPress={loadNames} />
          </View>
        )}
        <FlatList
          data={names}
          keyExtractor={(item) => item._id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setSelectedUser(item);
                setPin('');
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedUser?._id === item._id }}
              style={[
                styles.nameRow,
                selectedUser?._id === item._id && styles.nameRowSelected,
              ]}
            >
              <Text style={[typography.body, { flexShrink: 1, marginRight: spacing.sm }]}>{item.name}</Text>
              <Text style={typography.bodyMuted}>{item.role ? item.role[0].toUpperCase() + item.role.slice(1) : ''}</Text>
            </Pressable>
          )}
        />

        {selectedUser && (
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.bodyMuted, { marginBottom: spacing.sm }]}>Enter your PIN</Text>
            <TextInput
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              style={styles.pinInput}
              placeholder="••••"
              autoFocus
              onSubmitEditing={handleLogin}
              returnKeyType="go"
            />
            <Button title="Log In" onPress={handleLogin} loading={loading} disabled={!pin} style={{ marginTop: spacing.md }} />
          </View>
        )}
      </Card>

      {/* So you can tell at a glance which build is installed. */}
      <Text style={[typography.bodyMuted, { textAlign: 'center', marginTop: 'auto' }]}>
        Version {Constants.expoConfig?.version}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  nameRowSelected: {
    backgroundColor: colors.background,
    borderRadius: radii.sm,
  },
  pinInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    backgroundColor: colors.white,
  },
});
