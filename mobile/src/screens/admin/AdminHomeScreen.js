import React from 'react';
import { Text, Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import { colors, spacing, radii, typography } from '../../theme/tokens';

const LINKS = [
  { route: 'Messages', icon: 'mail-outline', title: 'Messages', sub: '"I need help" requests and other notes from the contact form' },
  { route: 'Inventory', icon: 'cube-outline', title: 'Inventory', sub: 'Add, edit, and reorder items' },
  { route: 'Budget', icon: 'wallet-outline', title: 'Budget', sub: "This month's spending" },
  { route: 'Reports', icon: 'bar-chart-outline', title: 'Reports', sub: 'Charts and PDFs for grants and the board' },
  { route: 'EventsList', icon: 'calendar-outline', title: 'Past Events', sub: 'Counts and notes from each outreach' },
  { route: 'SurveyResults', icon: 'people-outline', title: 'Survey Results', sub: 'Community survey totals and contact requests' },
];

// The Admin tab - one place for every admin tool, instead of the buttons
// that used to be stacked under the tally counter.
export default function AdminHomeScreen({ navigation }) {
  return (
    <Screen>
      {LINKS.map((link) => (
        <Pressable
          key={link.route}
          onPress={() => navigation.navigate(link.route)}
          accessibilityRole="button"
          accessibilityLabel={`${link.title}. ${link.sub}`}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name={link.icon} size={28} color={colors.primary} style={{ marginRight: spacing.md }} />
          <View style={{ flex: 1 }}>
            <Text style={typography.h2}>{link.title}</Text>
            <Text style={typography.bodyMuted}>{link.sub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
});
