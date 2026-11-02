import React, { useState } from 'react';
import { View, FlatList, Pressable, Alert, StyleSheet } from 'react-native';
import Text from './Text';
import TextInput from './TextInput';
import Button from './Button';
import { brand, colors, inputStyle, radii, spacing, typography } from '../theme/tokens';

const ROLE_LABEL = { admin: 'Admin', volunteer: 'Volunteer' };

export function formatTime(iso) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return today ? time : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

// A conversation: bubbles (newest at the bottom, like texting) and a box to
// write in. Used by Team chat and by each conversation in Messages.
//   messages: oldest first, each { _id, body, createdAt, author: { _id, name, role } }
//   onSend(body): resolves true when sent (the box is then cleared)
//   onDelete(message) / canDelete(message): optional, press and hold
export default function ChatView({ messages, userId, onSend, onDelete, canDelete, onLoadOlder, emptyText, error, placeholder = 'Write a message…' }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      if (await onSend(body)) setDraft('');
    } finally {
      setSending(false);
    }
  }

  function confirmDelete(message) {
    Alert.alert('Delete this message?', 'It will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(message) },
    ]);
  }

  return (
    <>
      {messages && messages.length > 0 ? (
        <FlatList
          inverted
          data={messages ? [...messages].reverse() : []}
          keyExtractor={(m) => m._id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onEndReached={onLoadOlder}
          onEndReachedThreshold={0.3}
          contentContainerStyle={{ paddingVertical: spacing.sm, flexGrow: 1 }}
          renderItem={({ item }) => {
            const mine = String(item.author?._id) === String(userId);
            const deletable = onDelete && canDelete?.(item);
            return (
              <Pressable
                onLongPress={deletable ? () => confirmDelete(item) : undefined}
                accessibilityHint={deletable ? 'Press and hold to delete' : undefined}
                accessibilityLabel={`${mine ? 'You' : item.author?.name || 'Someone'}, ${formatTime(item.createdAt)}: ${item.body}`}
                style={[styles.bubble, mine ? styles.mine : styles.theirs]}
              >
                {!mine && (
                  <Text style={styles.author}>
                    {item.author?.name || 'Someone'}
                    {item.author?.role ? ` · ${ROLE_LABEL[item.author.role] || item.author.role}` : ''}
                  </Text>
                )}
                <Text style={{ color: mine ? colors.white : colors.text }}>{item.body}</Text>
                <Text style={[styles.time, mine && { color: brand.tealSoft }]}>{formatTime(item.createdAt)}</Text>
              </Pressable>
            );
          }}
        />
      ) : (
        // Shown outside the list: an inverted (newest-at-bottom) list flips
        // its empty state differently across React Native versions.
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingVertical: spacing.sm }}>
          <Text style={typography.bodyMuted}>{messages === null ? error || 'Loading…' : emptyText}</Text>
        </View>
      )}

      {!!error && messages !== null && (
        <Text style={[typography.bodyMuted, { color: colors.danger, marginBottom: spacing.xs }]}>
          Can't reach the server right now. Showing what was loaded.
        </Text>
      )}

      <View style={styles.compose}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          multiline
          maxLength={2000}
          style={[inputStyle, { flex: 1, maxHeight: 120, marginRight: spacing.sm }]}
          accessibilityLabel={placeholder}
        />
        <Button title="Send" icon="send" small onPress={send} loading={sending} disabled={!draft.trim()} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '85%',
    paddingVertical: spacing.sm,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: brand.ink,
    marginBottom: spacing.sm,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: brand.teal },
  theirs: { alignSelf: 'flex-start', backgroundColor: brand.paper },
  author: { fontSize: 15, fontWeight: '700', color: colors.textMuted, marginBottom: 2 },
  time: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  compose: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: spacing.sm },
});
