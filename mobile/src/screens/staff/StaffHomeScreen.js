import React, { useCallback, useState } from 'react';
import { View, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Text from '../../components/Text';
import Screen from '../../components/Screen';
import Icon from '../../components/Icon';
import Lift from '../../components/Lift';
import { EmptyNote, TextLink } from '../../components/Brand';
import { NeedCard, formatNumber, formatOutreachDate } from '../../components/PublicData';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { brand, colors, lift, radii, spacing, typography } from '../../theme/tokens';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const TILE = {
  teal: { bg: brand.teal, fg: colors.white, sub: brand.tealSoft },
  coin: { bg: brand.coinSoft, fg: brand.ink, sub: colors.textMuted },
  heart: { bg: brand.heartSoft, fg: brand.ink, sub: colors.textMuted },
  plain: { bg: brand.paper, fg: brand.ink, sub: colors.textMuted },
};

function ActionTile({ icon, title, sub, tone = 'plain', onPress }) {
  const t = TILE[tone];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} style={{ width: '48.5%', marginBottom: spacing.md }}>
      {({ pressed }) => (
        <Lift
          offset={lift}
          radius={radii.lg}
          pressed={pressed}
          style={{ minHeight: 140, padding: 16, borderWidth: 2, borderColor: brand.ink, borderRadius: radii.lg, backgroundColor: t.bg, justifyContent: 'space-between' }}
        >
          <Icon name={icon} size={30} color={t.fg} />
          <View>
            <Text style={{ fontFamily: 'display', fontWeight: '600', fontSize: 20, lineHeight: 24, color: t.fg }}>{title}</Text>
            <Text style={{ fontSize: 15, lineHeight: 20, color: t.sub }}>{sub}</Text>
          </View>
        </Lift>
      )}
    </Pressable>
  );
}

function Stat({ value, label, tone, onPress }) {
  const color = tone === 'out' ? '#8C1233' : tone === 'low' ? '#6A4B00' : tone === 'danger' ? colors.danger : brand.ink;
  const body = (
    <View style={{ padding: 14, borderWidth: 2, borderColor: brand.ink, borderRadius: radii.lg, backgroundColor: brand.paper, minHeight: 96 }}>
      <Text style={{ fontFamily: 'display', fontWeight: '600', fontSize: 34, lineHeight: 38, color }}>{value}</Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textMuted }}>{label}</Text>
    </View>
  );
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : 'text'} style={{ width: '48.5%', marginBottom: spacing.md }}>
      {body}
    </Pressable>
  );
}

// Where every volunteer and admin lands after logging in - the website's
// staff home: the four common jobs as big buttons, then what needs
// attention.
export default function StaffHomeScreen({ navigation }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [items, setItems] = useState(null);
  const [summary, setSummary] = useState(null);
  const [budget, setBudget] = useState(null);
  const [inbox, setInbox] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const jobs = [
      api.getItems().then(setItems).catch(() => setItems((v) => v || [])),
      api.getPublicSummary().then(setSummary).catch(() => {}),
    ];
    if (isAdmin) {
      jobs.push(api.getCurrentBudget().then(setBudget).catch(() => {}));
      jobs.push(
        Promise.all([api.getContactMessages(), api.getSurveyContactRequests()])
          .then(([m, c]) => setInbox({ messages: m.filter((x) => !x.resolved).length, contactRequests: c.length }))
          .catch(() => {})
      );
    }
    await Promise.all(jobs);
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const out = (items || []).filter((i) => i.currentStock <= 0);
  const low = (items || []).filter((i) => i.currentStock > 0 && i.currentStock <= i.lowThreshold);
  const attention = [...out, ...low];

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Text style={typography.h1} accessibilityRole="header">
        {greeting()}, {user?.name?.split(' ')[0]}
      </Text>
      <Text style={[typography.bodyMuted, { marginTop: 4, marginBottom: spacing.lg }]}>
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        {summary?.nextOutreach ? ` · Next outreach ${formatOutreachDate(summary.nextOutreach.date)}` : ''}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <ActionTile tone="teal" icon="counter" title="Count people" sub="Tap once per person served" onPress={() => navigation.navigate('Count')} />
        <ActionTile tone="coin" icon="box" title="Inventory" sub="Hand out, restock, check what's low" onPress={() => navigation.navigate('Inventory')} />
        <ActionTile icon="clipboard" title="Take a survey" sub="With someone, or type in a paper one" onPress={() => navigation.navigate('Survey')} />
        {isAdmin ? (
          <ActionTile
            tone="heart"
            icon="mail"
            title="Messages"
            sub={inbox ? `${inbox.messages} new · ${inbox.contactRequests} asked to be contacted` : 'From the website and app'}
            onPress={() => navigation.navigate('Messages')}
          />
        ) : (
          <ActionTile tone="heart" icon="globe" title="Public website" sub="What neighbors see" onPress={() => navigation.navigate('PublicHome')} />
        )}
      </View>

      <Text style={[typography.h2, { marginTop: spacing.lg, marginBottom: 14 }]}>At a glance</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Stat value={summary ? formatNumber(summary.peopleServed.thisMonth) : '–'} label="People served this month" />
        <Stat value={summary ? formatNumber(summary.itemsGiven.thisMonth) : '–'} label="Items handed out this month" />
        <Stat value={items ? out.length : '–'} label="Items out of stock" tone="out" onPress={() => navigation.navigate('Inventory')} />
        {isAdmin && budget ? (
          <Stat
            value={`$${formatNumber(Math.round(budget.remaining))}`}
            label="Budget left this month"
            tone={budget.remaining < 0 ? 'danger' : undefined}
            onPress={() => navigation.navigate('Budget')}
          />
        ) : (
          <Stat value={items ? low.length : '–'} label="Items running low" tone="low" onPress={() => navigation.navigate('Inventory')} />
        )}
      </View>

      <Text style={[typography.h2, { marginTop: spacing.lg, marginBottom: 14 }]}>Needs restocking</Text>
      {items && attention.length === 0 && <EmptyNote>Everything is above its low mark. Nice.</EmptyNote>}
      {attention.slice(0, 8).map((item) => (
        <NeedCard
          key={item._id}
          item={{ ...item, status: item.currentStock <= 0 ? 'out' : 'low' }}
          note={`${item.currentStock} ${item.unitType}${item.currentStock === 1 ? '' : 's'} left · low at ${item.lowThreshold}`}
        />
      ))}
      {attention.length > 8 && <TextLink title={`See all ${attention.length}`} onPress={() => navigation.navigate('Inventory')} />}
    </Screen>
  );
}
