import React, { useCallback, useRef, useState } from 'react';
import { View, FlatList, Pressable, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { brand, colors, inputStyle, radii, spacing, typography } from '../../theme/tokens';

const SEEN_KEY = 'fsf_team_chat_seen';
const POLL_MS = 8000;
const ROLE_LABEL = { admin: 'Admin', volunteer: 'Volunteer' };

// For the "3 new" note on the staff home screen.
export async function countUnreadChat(userId) {
  const [messages, seen] = await Promise.all([api.getTeamChat(), AsyncStorage.getItem(SEEN_KEY)]);
  const seenAt = seen ? new Date(seen).getTime() : 0;
  return messages.filter((m) => new Date(m.createdAt).getTime() > seenAt && String(m.author?._id) !== String(userId)).length;
}

function markSeen(messages) {
  const last = messages[messages.length - 1];
  if (last) AsyncStorage.setItem(SEEN_KEY, last.createdAt).catch(() => {});
}

function formatTime(iso) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return today ? time : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

// Team chat: one conversation for every volunteer and admin. New messages
// show up every few seconds while this screen is open, and as a
// notification otherwise (for anyone with "Team chat" switched on).
export default function TeamChatScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState(null); // oldest first
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [olderDone, setOlderDone] = useState(false);
  const loadingOlder = useRef(false);

  const loadLatest = useCallback(async () => {
    try {
      const latest = await api.getTeamChat();
      setMessages((prev) => {
        // Keep older pages already loaded; the latest page replaces its own
        // time span, so deleted messages disappear.
        const cutoff = latest.length ? new Date(latest[0].createdAt).getTime() : Infinity;
        const older = (prev || []).filter((m) => new Date(m.createdAt).getTime() < cutoff);
        const next = [...older, ...latest];
        markSeen(next);
        return next;
      });
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLatest();
      const timer = setInterval(loadLatest, POLL_MS);
      return () => clearInterval(timer);
    }, [loadLatest])
  );

  async function loadOlder() {
    if (loadingOlder.current || olderDone || !messages?.length) return;
    loadingOlder.current = true;
    try {
      const older = await api.getTeamChat(messages[0].createdAt);
      if (older.length === 0) setOlderDone(true);
      else setMessages((prev) => [...older, ...prev]);
    } catch {
      // Try again on the next scroll.
    } finally {
      loadingOlder.current = false;
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const message = await api.postTeamChat(body);
      setDraft('');
      setMessages((prev) => {
        const next = [...(prev || []), message];
        markSeen(next);
        return next;
      });
    } catch (err) {
      Alert.alert('Message not sent', err.message);
    } finally {
      setSending(false);
    }
  }

  function confirmDelete(message) {
    Alert.alert('Delete this message?', 'It will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteTeamChat(message._id);
            setMessages((prev) => prev.filter((m) => m._id !== message._id));
          } catch (err) {
            Alert.alert('Could not delete', err.message);
          }
        },
      },
    ]);
  }

  return (
    <Screen scroll={false}>
      <FlatList
        // Newest at the bottom, like a text conversation.
        inverted
        data={messages ? [...messages].reverse() : []}
        keyExtractor={(m) => m._id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        contentContainerStyle={{ paddingVertical: spacing.sm }}
        renderItem={({ item }) => {
          const mine = String(item.author?._id) === String(user?._id);
          const canDelete = mine || user?.role === 'admin';
          return (
            <Pressable
              onLongPress={canDelete ? () => confirmDelete(item) : undefined}
              accessibilityHint={canDelete ? 'Press and hold to delete' : undefined}
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
        ListEmptyComponent={
          // Inverted lists flip their children too.
          <View style={{ transform: [{ scaleY: -1 }] }}>
            <Text style={typography.bodyMuted}>
              {messages === null
                ? error || 'Loading…'
                : 'No messages yet. Say hi - everyone on the team sees this, volunteers and admins.'}
            </Text>
          </View>
        }
      />

      {!!error && messages !== null && (
        <Text style={[typography.bodyMuted, { color: colors.danger, marginBottom: spacing.xs }]}>
          Can't reach the server right now. Showing what was loaded.
        </Text>
      )}

      <View style={styles.compose}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message the team…"
          multiline
          maxLength={2000}
          style={[inputStyle, { flex: 1, maxHeight: 120, marginRight: spacing.sm }]}
          accessibilityLabel="Message the team"
        />
        <Button title="Send" icon="send" small onPress={send} loading={sending} disabled={!draft.trim()} />
      </View>
    </Screen>
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
