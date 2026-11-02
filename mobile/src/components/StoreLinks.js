import React from 'react';
import { View, Linking, Alert, StyleSheet } from 'react-native';
import Text from './Text';
import TextInput from './TextInput';
import Button from './Button';
import { STORES, storeLabel } from '../config/org';
import { brand, inputStyle, spacing, typography } from '../theme/tokens';

// Where to buy an item: any number of stores (Amazon, Temu, Dollar General,
// Walmart...), each with a link and optionally a price and how many come in
// the pack, so the cheapest per unit can be marked. Same as the website's
// SourcesEditor - both save to the item's `sources`.

export const BLANK_SOURCE = { store: 'amazon', url: '', price: '', unitsPerPack: '', note: '' };

export function perUnit(source) {
  const price = Number(source.price);
  if (!price) return null;
  return price / (Number(source.unitsPerPack) || 1);
}

function cheapestIndex(sources) {
  const prices = sources.map(perUnit);
  const priced = prices.filter((p) => p != null);
  if (priced.length < 2) return -1;
  return prices.indexOf(Math.min(...priced));
}

function isLink(url) {
  return /^https?:\/\/\S+$/i.test(String(url || '').trim());
}

async function open(url) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open link', 'This store link looks wrong. Fix it in Edit items.');
  }
}

// Form state -> what the API takes. Throws a readable message if a link is bad.
export function sourcesForSave(sources) {
  return sources
    .filter((s) => String(s.url || '').trim())
    .map((s) => {
      if (!isLink(s.url)) throw new Error(`The ${storeLabel(s)} link needs to start with https://`);
      return {
        store: s.store,
        url: s.url.trim(),
        price: s.price === '' || s.price == null ? null : Number(s.price),
        unitsPerPack: s.unitsPerPack === '' || s.unitsPerPack == null ? null : Number(s.unitsPerPack),
        note: String(s.note || '').trim(),
      };
    });
}

// Item from the API -> form state (numbers as text for the inputs).
export function sourcesForForm(item) {
  return (item?.sources || []).map((s) => ({
    store: s.store,
    url: s.url || '',
    price: s.price == null ? '' : String(s.price),
    unitsPerPack: s.unitsPerPack == null ? '' : String(s.unitsPerPack),
    note: s.note || '',
  }));
}

// "Reorder" buttons on an item card: one per store, cheapest marked.
export function ReorderLinks({ item, style }) {
  const sources = (item.sources || []).filter((s) => isLink(s.url));
  if (!sources.length) return null;
  const cheapest = cheapestIndex(sources);
  return (
    <View style={[styles.wrap, style]}>
      <Text style={[typography.label, { width: '100%', marginBottom: spacing.xs }]}>Reorder</Text>
      {sources.map((s, i) => {
        const each = perUnit(s);
        return (
          <Button
            key={s._id || i}
            title={`${storeLabel(s)}${each != null ? ` · $${each.toFixed(2)} each` : ''}${i === cheapest ? ' ★' : ''}`}
            accessibilityLabel={`Reorder ${item.name} at ${storeLabel(s)}${i === cheapest ? ', cheapest' : ''}`}
            iconRight="external"
            small
            variant={i === cheapest ? 'coin' : 'outline'}
            onPress={() => open(s.url)}
            style={styles.chip}
          />
        );
      })}
    </View>
  );
}

// The editor in the Add/Edit item form.
export default function StoreLinksEditor({ value, onChange }) {
  const sources = value || [];
  const cheapest = cheapestIndex(sources);
  const update = (i, field, v) => onChange(sources.map((s, idx) => (idx === i ? { ...s, [field]: v } : s)));

  return (
    <View>
      {sources.length === 0 && <Text style={typography.bodyMuted}>No store links yet.</Text>}
      {sources.map((s, i) => {
        const each = perUnit(s);
        return (
          <View key={i} style={styles.source}>
            <View style={styles.wrap}>
              {Object.entries(STORES).map(([code, label]) => (
                <Button key={code} title={label} small variant={s.store === code ? 'primary' : 'outline'} onPress={() => update(i, 'store', code)} style={styles.chip} />
              ))}
            </View>
            {s.store === 'other' && (
              <TextInput accessibilityLabel="Store name" value={s.note} onChangeText={(v) => update(i, 'note', v)} style={[inputStyle, styles.gap]} placeholder="Store name" />
            )}
            <TextInput
              value={s.url}
              onChangeText={(v) => update(i, 'url', v)}
              style={[inputStyle, styles.gap]}
              placeholder="https://"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={`${storeLabel(s)} link`}
            />
            <View style={[styles.row, styles.gap]}>
              <TextInput
                value={s.price}
                onChangeText={(v) => update(i, 'price', v)}
                style={[inputStyle, { flex: 1, marginRight: spacing.sm }]}
                placeholder="Price $"
                keyboardType="decimal-pad"
                accessibilityLabel="Price for the pack"
              />
              <TextInput
                value={s.unitsPerPack}
                onChangeText={(v) => update(i, 'unitsPerPack', v)}
                style={[inputStyle, { flex: 1 }]}
                placeholder="How many in it"
                keyboardType="number-pad"
                accessibilityLabel="How many in the pack"
              />
            </View>
            <View style={[styles.row, styles.gap, { justifyContent: 'space-between' }]}>
              <Text style={typography.bodyMuted}>
                {each != null ? `$${each.toFixed(2)} each${i === cheapest ? ' · cheapest' : ''}` : ' '}
              </Text>
              <View style={styles.row}>
                {isLink(s.url) && <Button title="Open" small variant="outline" iconRight="external" onPress={() => open(s.url.trim())} style={{ marginRight: spacing.xs }} />}
                <Button title="Remove" small variant="outline-danger" onPress={() => onChange(sources.filter((_, idx) => idx !== i))} />
              </View>
            </View>
          </View>
        );
      })}
      <Button title="Add a store" icon="plus" small variant="outline" onPress={() => onChange([...sources, { ...BLANK_SOURCE }])} style={{ alignSelf: 'flex-start', marginTop: spacing.sm }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center' },
  chip: { marginRight: spacing.xs, marginBottom: spacing.xs },
  gap: { marginTop: spacing.sm },
  source: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: brand.line },
});

