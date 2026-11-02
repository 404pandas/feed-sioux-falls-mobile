import React, { useCallback, useState } from 'react';
import { View, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Text from '../../components/Text';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { formatTime } from '../../components/ChatView';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { countUnreadChat } from './TeamChatScreen';
import { brand, colors, spacing, typography } from '../../theme/tokens';

// "Val, Ada and 3 others" - who else is in a conversation.
export function othersLabel(participants, userId) {
  const others = participants.filter((p) => String(p._id) !== String(userId)).map((p) => p.name || 'Someone');
  if (others.length <= 2) return others.join(' and ') || 'Just you';
  return `${others.slice(0, 2).map((n) => n.split(' ')[0]).join(', ')} and ${others.length - 2} other${others.length - 2 === 1 ? '' : 's'}`;
}

// Messages: Team chat (everyone) pinned at the top, then conversations with
// the people you chose. Unread ones are bold with a dot.
export default function InboxScreen({ navigation }) {
  const { user } = useAuth();
  const [threads, setThreads] = useState(null);
  const [teamUnread, setTeamUnread] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, team] = await Promise.all([api.getInbox(), countUnreadChat(user?._id).catch(() => 0)]);
      setThreads(list);
      setTeamUnread(team);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, 15000);
      return () => clearInterval(timer);
    }, [load])
  );

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Text style={typography.h1} accessibilityRole="header">
        Messages
      </Text>
      <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        Write to all volunteers, all admins, or just the people you pick. They get a notification.
      </Text>
      <Button title="New message" icon="plus" onPress={() => navigation.navigate('NewMessage')} style={{ marginBottom: spacing.lg }} />

      <Pressable onPress={() => navigation.navigate('TeamChat')} accessibilityRole="button" accessibilityLabel={`Team chat, everyone.${teamUnread ? ` ${teamUnread} new.` : ''}`}>
        <Card style={{ marginBottom: spacing.lg, backgroundColor: brand.heartSoft }}>
          <View style={styles.row}>
            <Icon name="chat" size={26} style={{ marginRight: spacing.md }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>Team chat</Text>
              <Text style={typography.bodyMuted}>Everyone - every volunteer and admin</Text>
            </View>
            {teamUnread > 0 && <Text style={styles.badge}>{teamUnread}</Text>}
          </View>
        </Card>
      </Pressable>

      {!!error && <Text style={[typography.body, { color: colors.danger, marginBottom: spacing.md }]}>{error}</Text>}
      {threads && threads.length === 0 && <Text style={typography.bodyMuted}>No conversations yet. Tap "New message" to start one.</Text>}
      {threads?.map((t) => {
        const who = othersLabel(t.participants, user?._id);
        return (
          <Pressable
            key={t._id}
            onPress={() => navigation.navigate('Thread', { threadId: t._id })}
            accessibilityRole="button"
            accessibilityLabel={`${t.unread ? 'Unread. ' : ''}${who}. ${t.lastMessage}`}
            style={{ marginBottom: spacing.sm }}
          >
            <Card>
              <View style={styles.row}>
                {t.unread && <View style={styles.dot} />}
                <View style={{ flex: 1 }}>
                  <View style={styles.row}>
                    <Text style={{ flex: 1, fontWeight: t.unread ? '700' : '400' }} numberOfLines={1}>
                      {who}
                    </Text>
                    <Text style={[typography.bodyMuted, { fontSize: 14, marginLeft: spacing.sm }]}>{formatTime(t.lastMessageAt)}</Text>
                  </View>
                  <Text style={typography.bodyMuted} numberOfLines={2}>
                    {t.lastMessage}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: brand.heart, marginRight: spacing.sm },
  badge: { minWidth: 28, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 14, overflow: 'hidden', backgroundColor: brand.heart, color: colors.white, fontWeight: '700', textAlign: 'center' },
});
