import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Linking, RefreshControl, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { CATEGORIES } from '../../components/SupportForms';
import { colors, spacing, typography } from '../../theme/tokens';
import { api } from '../../api/client';

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

// Admin inbox for the contact form (including "I need help" requests and
// survey translation offers). Same as the website's Messages page:
// "I need help" first and highlighted, tap to call or email.
export default function MessagesScreen() {
  const [messages, setMessages] = useState([]);
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMessages(await api.getContactMessages());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function resolve(id) {
    try {
      const updated = await api.resolveContactMessage(id);
      setMessages((list) => list.map((m) => (m._id === id ? updated : m)));
    } catch (err) {
      Alert.alert('Could not mark that as handled', err.message);
    }
  }

  const visible = messages
    .filter((m) => showResolved || !m.resolved)
    .sort((a, b) => (a.category === 'assistance' ? 0 : 1) - (b.category === 'assistance' ? 0 : 1));
  const openCount = messages.filter((m) => !m.resolved).length;

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Text style={typography.h1}>Messages</Text>
      <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        From the contact form. {openCount} open. Pull down to refresh.
      </Text>

      <Pressable
        onPress={() => setShowResolved((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: showResolved }}
        style={styles.toggle}
      >
        <View style={[styles.box, showResolved && styles.boxOn]}>{showResolved && <Text style={styles.check}>✓</Text>}</View>
        <Text style={typography.body}>Show handled messages too</Text>
      </Pressable>

      {!!error && (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={[typography.body, { color: colors.danger, marginBottom: spacing.sm }]}>{error}</Text>
          <Button title="Try Again" variant="outline" onPress={load} />
        </View>
      )}
      {!loading && !error && visible.length === 0 && <Text style={typography.bodyMuted}>No open messages.</Text>}

      {visible.map((m) => {
        const urgent = m.category === 'assistance';
        return (
          <Card key={m._id} style={[{ marginBottom: spacing.md }, urgent && !m.resolved && styles.urgentCard]}>
            <Text style={typography.bodyMuted}>
              <Text style={{ fontWeight: '700', color: urgent ? colors.accent : colors.textMuted }}>
                {CATEGORY_LABELS[m.category] || m.category}
              </Text>
              {' · '}
              {new Date(m.date || m.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              {m.resolved ? ' · Handled' : ''}
            </Text>
            <Text style={[typography.body, { marginTop: spacing.sm }]}>{m.message}</Text>
            <Text style={[typography.body, { marginTop: spacing.sm }]}>{m.name || 'No name given'}</Text>
            {!!m.phone && (
              <Pressable onPress={() => Linking.openURL(`tel:${m.phone}`)} accessibilityRole="link" hitSlop={6}>
                <Text style={styles.link}>{m.phone}</Text>
              </Pressable>
            )}
            {!!m.email && (
              <Pressable onPress={() => Linking.openURL(`mailto:${m.email}`)} accessibilityRole="link" hitSlop={6}>
                <Text style={styles.link}>{m.email}</Text>
              </Pressable>
            )}
            {!m.phone && !m.email && <Text style={typography.bodyMuted}>No way to reply was left.</Text>}
            {!m.resolved && (
              <Button
                title="Mark as handled"
                variant="outline"
                textColor={colors.success}
                onPress={() => resolve(m._id)}
                style={{ marginTop: spacing.md, borderColor: colors.success, minHeight: 44, paddingVertical: spacing.sm }}
              />
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', minHeight: 44, marginBottom: spacing.md },
  box: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 4,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  boxOn: { backgroundColor: colors.primary },
  check: { color: colors.white, fontWeight: '700' },
  urgentCard: { borderColor: colors.accent, borderWidth: 2 },
  link: { ...typography.body, color: colors.primary, textDecorationLine: 'underline', paddingVertical: 4 },
});
