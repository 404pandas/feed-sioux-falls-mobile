import React, { useCallback, useEffect, useState } from 'react';
import { View, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { api } from '../../api/client';
import { brand, colors, inputStyle, spacing, typography } from '../../theme/tokens';

const AUDIENCES = [
  { key: 'staff', label: 'Volunteers & admins', sub: 'Staff notices. Only phones logged in as a volunteer or admin.' },
  { key: 'everyone', label: 'Everyone', sub: 'Every phone with the app that has this kind of notice turned on.' },
];

// What a notice to everyone is about - each is its own on/off switch on
// people's phones.
const PUBLIC_KINDS = [
  { key: 'outreach', label: 'Outreach' },
  { key: 'pantry', label: 'Pantry news' },
  { key: 'needs', label: 'We need…' },
];

const TITLE_MAX = 80;
const BODY_MAX = 300;

// Admins: send a push notification. See who it goes to and what it will
// look like, then confirm with the number of phones. Every send is kept
// (Sent Notifications and the Change Log on the website).
export default function SendNotificationScreen() {
  const [audience, setAudience] = useState('staff');
  const [kind, setKind] = useState('outreach');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [count, setCount] = useState(null);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [sentCount, setSentCount] = useState(0); // recount after each send

  const loadHistory = useCallback(() => {
    api.getSentNotifications().then(setHistory).catch(() => {});
  }, []);
  useFocusEffect(loadHistory);

  useEffect(() => {
    let live = true;
    setCount(null);
    api
      .getNotificationAudience(audience, audience === 'everyone' ? kind : undefined)
      .then((r) => live && setCount(r.count))
      .catch(() => live && setCount(undefined));
    return () => {
      live = false;
    };
  }, [audience, kind, sentCount]);

  function confirmSend() {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Almost there', 'Add a title and a message.');
      return;
    }
    if (count === 0) {
      Alert.alert('No one to send to', 'No phones have this kind of notification turned on yet.');
      return;
    }
    const who = count == null ? 'these phones' : `${count} phone${count === 1 ? '' : 's'}`;
    Alert.alert(`Send to ${who}?`, `"${title.trim()}"\n\nThis can't be unsent.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: send },
    ]);
  }

  async function send() {
    setSending(true);
    try {
      const result = await api.sendNotification({
        title: title.trim(),
        body: body.trim(),
        audience,
        kind: audience === 'everyone' ? kind : undefined,
      });
      setTitle('');
      setBody('');
      loadHistory();
      setSentCount((n) => n + 1);
      Alert.alert('Sent', `Sent to ${result.recipients} phone${result.recipients === 1 ? '' : 's'}.`);
    } catch (err) {
      Alert.alert('Not sent', err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <Text style={typography.h1} accessibilityRole="header">
        Send a notification
      </Text>
      <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        Shows up on phones like a text. Keep it short.
      </Text>

      <Text style={styles.label}>Who gets it</Text>
      {AUDIENCES.map((a) => (
        <Button
          key={a.key}
          title={a.label}
          variant={audience === a.key ? 'primary' : 'outline'}
          onPress={() => setAudience(a.key)}
          style={{ marginBottom: spacing.sm }}
        />
      ))}
      <Text style={[typography.bodyMuted, { marginBottom: spacing.md }]}>{AUDIENCES.find((a) => a.key === audience).sub}</Text>

      {audience === 'everyone' && (
        <>
          <Text style={styles.label}>What it's about</Text>
          <View style={styles.chips}>
            {PUBLIC_KINDS.map((k) => (
              <Button
                key={k.key}
                title={k.label}
                small
                variant={kind === k.key ? 'primary' : 'outline'}
                onPress={() => setKind(k.key)}
                style={{ marginRight: spacing.xs, marginBottom: spacing.xs }}
              />
            ))}
          </View>
          <Text style={[typography.bodyMuted, { marginBottom: spacing.md }]}>
            Anyone might see this on a shared phone. Keep the wording neutral: "Supplies were restocked", not "Get free
            food".
          </Text>
        </>
      )}

      <Text style={styles.label}>Title</Text>
      <TextInput accessibilityLabel="Title" value={title} onChangeText={setTitle} maxLength={TITLE_MAX} style={inputStyle} placeholder="Meet at 9:30 Saturday" />
      <Text style={styles.counter}>
        {title.length}/{TITLE_MAX}
      </Text>

      <Text style={styles.label}>Message</Text>
      <TextInput accessibilityLabel="Message"
        value={body}
        onChangeText={setBody}
        maxLength={BODY_MAX}
        multiline
        style={[inputStyle, { minHeight: 110, textAlignVertical: 'top' }]}
        placeholder="It's cold - bring extra gloves if you have them."
      />
      <Text style={styles.counter}>
        {body.length}/{BODY_MAX}
      </Text>

      <Text style={[styles.label, { marginTop: spacing.md }]}>Preview</Text>
      <View style={styles.preview}>
        <Text style={{ fontSize: 14, color: colors.textMuted }}>Feed Sioux Falls · now</Text>
        <Text style={{ fontWeight: '700' }}>{title.trim() || 'Title'}</Text>
        <Text>{body.trim() || 'Your message'}</Text>
      </View>
      <Text style={[typography.bodyMuted, { marginBottom: spacing.md }]}>
        Phones with "Hide what notifications say" on will only see "You have a new update".
      </Text>

      <Text style={[typography.body, { fontWeight: '700', marginBottom: spacing.sm }]}>
        {count === null ? 'Counting phones…' : count === undefined ? "Couldn't count phones (no signal?)" : `Goes to ${count} phone${count === 1 ? '' : 's'}`}
      </Text>
      <Button title="Send" icon="send" onPress={confirmSend} loading={sending} disabled={!title.trim() || !body.trim()} />

      {history.length > 0 && (
        <>
          <Text style={[typography.h2, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>Sent before</Text>
          {history.map((n) => (
            <Card key={n._id} style={{ marginBottom: spacing.sm }}>
              <Text style={{ fontWeight: '700' }}>{n.title}</Text>
              <Text>{n.body}</Text>
              <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
                {n.audience === 'staff' ? 'Volunteers & admins' : `Everyone · ${PUBLIC_KINDS.find((k) => k.key === n.kind)?.label || n.kind}`} ·{' '}
                {n.recipients} phone{n.recipients === 1 ? '' : 's'} · {n.sentBy?.name || 'Admin'} ·{' '}
                {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, marginBottom: spacing.xs, marginTop: spacing.sm },
  counter: { fontSize: 14, color: colors.textMuted, textAlign: 'right', marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs },
  preview: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: brand.paper,
    borderWidth: 1,
    borderColor: brand.line,
    borderRadius: 16,
  },
});
