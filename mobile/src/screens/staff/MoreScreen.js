import React from 'react';
import { View, Pressable, Alert, Linking, StyleSheet } from 'react-native';
import Text from '../../components/Text';
import Screen from '../../components/Screen';
import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { brand, colors, radii, spacing } from '../../theme/tokens';
import { websiteUrl } from '../../config/org';

// The "More" tab - the website's sidebar groups. Admin tools first, then
// the public screens, then Log out. The database pages (All data, People &
// logins, Change log) are website-only, so they open the website.
const RUN = [
  { route: 'Messages', icon: 'mail', title: 'Messages', sub: '"I need help" requests and notes from the contact form' },
  { route: 'SurveyResults', icon: 'chart', title: 'Survey results', sub: 'Totals and people who asked to be contacted' },
  { route: 'ManageItems', icon: 'edit', title: 'Edit items', sub: 'Add, rename, set low marks and costs' },
  { route: 'Budget', icon: 'wallet', title: 'Budget', sub: "This month's spending" },
  { route: 'Reports', icon: 'chart', title: 'Reports', sub: 'Charts and PDFs for grants and the board' },
  { route: 'EventsList', icon: 'calendar', title: 'Past events', sub: 'Counts and notes from each outreach' },
];

function Row({ icon, title, sub, onPress, danger }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${title}. ${sub}` : title}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: brand.tealSoft }]}
    >
      <Icon name={icon} size={26} color={danger ? colors.danger : brand.teal} style={{ marginRight: spacing.md }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', fontSize: 18, color: danger ? colors.danger : brand.ink }}>{title}</Text>
        {!!sub && <Text style={{ fontSize: 15, color: colors.textMuted }}>{sub}</Text>}
      </View>
      <Icon name="chevronRight" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

function Group({ title }) {
  return <Text style={styles.group}>{title}</Text>;
}

export default function MoreScreen({ navigation }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  function confirmLogout() {
    Alert.alert('Log out?', 'You can log back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <Screen>
      <Text style={{ fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm }}>Logged in as {user?.name}</Text>
      {isAdmin && (
        <>
          <Group title="Run the pantry" />
          {RUN.map((r) => (
            <Row key={r.route} {...r} onPress={() => navigation.navigate(r.route)} />
          ))}
          <Group title="Database" />
          <Row
            icon="people"
            title="People, logins & all data"
            sub="On the website - opens your browser"
            onPress={() => Linking.openURL(`${websiteUrl}/data`)}
          />
        </>
      )}
      <Group title="Public" />
      <Row icon="globe" title="Public website" sub="What neighbors see" onPress={() => navigation.navigate('PublicHome')} />
      <View style={{ height: spacing.lg }} />
      <Row icon="logout" title="Log out" onPress={confirmLogout} danger />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.sm,
    backgroundColor: brand.paper,
    borderWidth: 2,
    borderColor: brand.ink,
    borderRadius: radii.md,
  },
});
