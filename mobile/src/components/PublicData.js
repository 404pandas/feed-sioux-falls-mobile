import React, { useCallback, useEffect, useState } from 'react';
import { View, Pressable, Linking } from 'react-native';
import Text from './Text';
import Icon from './Icon';
import Lift from './Lift';
import { Pill } from './Brand';
import { api } from '../api/client';
import { storeLabel } from '../config/org';
import { brand, radii, spacing, typography, liftSmall, lift } from '../theme/tokens';

// Same as the website's PublicData: /api/public/summary (cached a minute
// on the server). `summary` stays null on failure; every section that uses
// it hides itself or shows a fallback instead of an error.
export function usePublicSummary() {
  const [summary, setSummary] = useState(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    return api
      .getPublicSummary()
      .then(setSummary)
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { summary, failed, loading: !summary && !failed, reload: load };
}

export function formatNumber(n) {
  return Number(n || 0).toLocaleString('en-US');
}

export function formatOutreachDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function StatusPill({ status }) {
  if (status === 'out') return <Pill tone="out" label="Out right now" />;
  if (status === 'low') return <Pill tone="low" label="Running low" />;
  return <Pill tone="ok" label="Stocked" />;
}

export function StoreLinks({ sources, itemName }) {
  if (!sources?.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {sources.map((s) => (
        <Pressable
          key={s.url}
          onPress={() => Linking.openURL(s.url)}
          accessibilityRole="link"
          accessibilityLabel={`Buy ${itemName} at ${storeLabel(s)}`}
          style={{ marginRight: spacing.sm, marginTop: spacing.sm }}
        >
          {({ pressed }) => (
            <Lift
              offset={liftSmall}
              radius={radii.pill}
              pressed={pressed}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 40,
                paddingHorizontal: 14,
                borderWidth: 2,
                borderColor: brand.ink,
                borderRadius: radii.pill,
                backgroundColor: brand.paper,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700' }}>{storeLabel(s)}</Text>
              <Icon name="external" size={16} style={{ marginLeft: 6 }} />
            </Lift>
          )}
        </Pressable>
      ))}
    </View>
  );
}

// One "what we're short on" card: name, Out/Low, and store links.
export function NeedCard({ item, note, showLinks = true }) {
  return (
    <Lift
      offset={lift}
      radius={radii.lg}
      outerStyle={{ marginBottom: spacing.md }}
      style={{ padding: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: brand.paper, borderWidth: 2, borderColor: brand.ink }}
    >
      <Text style={{ fontFamily: 'display', fontWeight: '600', fontSize: 21, lineHeight: 26, marginBottom: spacing.sm }}>{item.name}</Text>
      <StatusPill status={item.status} />
      {!!note && <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>{note}</Text>}
      {showLinks && item.sources?.length > 0 && (
        <>
          <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>
            Where we buy it, if you'd like to pick some up for the pantry:
          </Text>
          <StoreLinks sources={item.sources} itemName={item.name} />
        </>
      )}
    </Lift>
  );
}

export function NeedsList({ items, limit, showLinks = true }) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <View>
      {shown.map((item) => (
        <NeedCard key={item._id} item={item} showLinks={showLinks} />
      ))}
    </View>
  );
}
