import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Text from '../../components/Text';
import Screen from '../../components/Screen';
import ChatView from '../../components/ChatView';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { othersLabel } from './InboxScreen';
import { spacing, typography } from '../../theme/tokens';

const POLL_MS = 8000;

// One conversation in Messages. Replies go to everyone in it.
export default function ThreadScreen({ route, navigation }) {
  const { threadId } = route.params;
  const { user } = useAuth();
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.getConversation(threadId);
      setThread(data.thread);
      setMessages(data.messages);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [threadId]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, POLL_MS);
      return () => clearInterval(timer);
    }, [load])
  );

  const who = thread ? othersLabel(thread.participants, user?._id) : '';
  useLayoutEffect(() => {
    navigation.setOptions({ title: who || 'Conversation' });
  }, [navigation, who]);

  async function send(body) {
    try {
      const message = await api.replyToConversation(threadId, body);
      setMessages((prev) => [...(prev || []), message]);
      return true;
    } catch (err) {
      Alert.alert('Message not sent', err.message);
      return false;
    }
  }

  const everyone = thread?.participants.filter((p) => String(p._id) !== String(user?._id)).map((p) => p.name);
  return (
    <Screen scroll={false}>
      {everyone && everyone.length > 2 && (
        <Text style={[typography.bodyMuted, { marginBottom: spacing.xs }]} numberOfLines={3}>
          With {everyone.join(', ')}
        </Text>
      )}
      <ChatView messages={messages} userId={user?._id} onSend={send} error={error} emptyText="No messages yet." placeholder="Reply to everyone here…" />
    </Screen>
  );
}
