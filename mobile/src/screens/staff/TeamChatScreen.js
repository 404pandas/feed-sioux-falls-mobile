import React, { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Screen from '../../components/Screen';
import ChatView from '../../components/ChatView';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const SEEN_KEY = 'fsf_team_chat_seen';
const POLL_MS = 8000;

// For the "new" note in Messages.
export async function countUnreadChat(userId) {
  const [messages, seen] = await Promise.all([api.getTeamChat(), AsyncStorage.getItem(SEEN_KEY)]);
  const seenAt = seen ? new Date(seen).getTime() : 0;
  return messages.filter((m) => new Date(m.createdAt).getTime() > seenAt && String(m.author?._id) !== String(userId)).length;
}

function markSeen(messages) {
  const last = messages[messages.length - 1];
  if (last) AsyncStorage.setItem(SEEN_KEY, last.createdAt).catch(() => {});
}

// Team chat: one conversation for every volunteer and admin. New messages
// show up every few seconds while this screen is open, and as a
// notification otherwise (for anyone with "Team chat & messages" on).
export default function TeamChatScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState(null); // oldest first
  const [error, setError] = useState('');
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

  async function send(body) {
    try {
      const message = await api.postTeamChat(body);
      setMessages((prev) => {
        const next = [...(prev || []), message];
        markSeen(next);
        return next;
      });
      return true;
    } catch (err) {
      Alert.alert('Message not sent', err.message);
      return false;
    }
  }

  async function remove(message) {
    try {
      await api.deleteTeamChat(message._id);
      setMessages((prev) => prev.filter((m) => m._id !== message._id));
    } catch (err) {
      Alert.alert('Could not delete', err.message);
    }
  }

  return (
    <Screen scroll={false}>
      <ChatView
        messages={messages}
        userId={user?._id}
        onSend={send}
        onDelete={remove}
        canDelete={(m) => String(m.author?._id) === String(user?._id) || user?.role === 'admin'}
        onLoadOlder={loadOlder}
        error={error}
        emptyText="No messages yet. Say hi - everyone on the team sees this, volunteers and admins."
        placeholder="Message the whole team…"
      />
    </Screen>
  );
}
