import React, { useEffect, useState } from 'react';
import { View, Pressable, Alert, StyleSheet } from 'react-native';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { api } from '../../api/client';
import { brand, colors, inputStyle, spacing, typography } from '../../theme/tokens';

const GROUPS = [
  { role: 'volunteer', label: 'All volunteers' },
  { role: 'admin', label: 'All admins' },
];

function Check({ on }) {
  return <View style={[styles.box, on && styles.boxOn]}>{on && <Text style={styles.tick}>✓</Text>}</View>;
}

// Write to people you choose: tap "All volunteers" and/or "All admins",
// untick anyone to leave out, or pick people one by one. Only they get the
// message and a notification. Replies go to everyone in the conversation.
export default function NewMessageScreen({ navigation }) {
  const [people, setPeople] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getInboxPeople()
      .then(setPeople)
      .catch((err) => setError(err.message));
  }, []);

  const inGroup = (role) => (people || []).filter((p) => p.role === role);
  const groupOn = (role) => inGroup(role).length > 0 && inGroup(role).every((p) => selected.has(p._id));

  function toggleGroup(role) {
    const ids = inGroup(role).map((p) => p._id);
    const on = groupOn(role);
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    if (!selected.size) return Alert.alert('Who is it for?', 'Choose at least one person.');
    if (!body.trim()) return Alert.alert('Almost there', 'Write a message.');
    setSending(true);
    try {
      const { thread } = await api.startConversation([...selected], body.trim());
      navigation.replace('Thread', { threadId: thread._id });
    } catch (err) {
      Alert.alert('Not sent', err.message);
      setSending(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.label}>To</Text>
      <View style={styles.wrap}>
        {GROUPS.map((g) => (
          <Button
            key={g.role}
            title={`${groupOn(g.role) ? '✓ ' : ''}${g.label} (${inGroup(g.role).length})`}
            small
            variant={groupOn(g.role) ? 'primary' : 'outline'}
            onPress={() => toggleGroup(g.role)}
            disabled={!inGroup(g.role).length}
            style={{ marginRight: spacing.xs, marginBottom: spacing.xs }}
          />
        ))}
      </View>
      <Text style={[typography.bodyMuted, { marginBottom: spacing.sm }]}>
        {selected.size ? `${selected.size} ${selected.size === 1 ? 'person' : 'people'} chosen. Untick anyone to leave them out.` : 'Pick a group, or people one by one.'}
      </Text>

      {!!error && <Text style={[typography.body, { color: colors.danger }]}>{error}</Text>}
      {!people && !error && <Text style={typography.bodyMuted}>Loading…</Text>}
      {people && (
        <Card style={{ marginBottom: spacing.lg }}>
          {people.length === 0 && <Text style={typography.bodyMuted}>No one else on the team has a login yet.</Text>}
          {people.map((p, i) => {
            const on = selected.has(p._id);
            return (
              <Pressable
                key={p._id}
                onPress={() => toggle(p._id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${p.name}, ${p.role === 'admin' ? 'admin' : 'volunteer'}`}
                style={[styles.person, i > 0 && styles.divider]}
              >
                <Check on={on} />
                <Text style={{ flex: 1 }}>{p.name}</Text>
                <Text style={typography.bodyMuted}>{p.role === 'admin' ? 'Admin' : 'Volunteer'}</Text>
              </Pressable>
            );
          })}
        </Card>
      )}

      <Text style={styles.label}>Message</Text>
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={2000}
        style={[inputStyle, { minHeight: 120, textAlignVertical: 'top' }]}
        placeholder="What do you want to tell them?"
        accessibilityLabel="Message"
      />
      <Button
        title={selected.size ? `Send to ${selected.size} ${selected.size === 1 ? 'person' : 'people'}` : 'Send'}
        icon="send"
        onPress={send}
        loading={sending}
        disabled={!selected.size || !body.trim()}
        style={{ marginTop: spacing.md }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, marginBottom: spacing.xs, marginTop: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  person: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: spacing.xs },
  divider: { borderTopWidth: 1, borderTopColor: brand.line },
  box: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: brand.ink,
    borderRadius: 6,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  boxOn: { backgroundColor: brand.teal, borderColor: brand.teal },
  tick: { color: colors.white, fontWeight: '700' },
});
