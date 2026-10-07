import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, FlatList, Alert, RefreshControl, StyleSheet } from 'react-native';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { colors, spacing, typography, radii, inputStyle } from '../../theme/tokens';
import { api } from '../../api/client';
import { queueAction, getQueueSize } from '../../utils/offlineQueue';

const STEPS = [1, 10, 20];
const CATEGORIES = ['all', 'hygiene', 'winter', 'other'];

// Volunteer-facing quick stock adjustment - +/- only, while counting people
// and handing out supplies. Deliberately has no add/edit/delete controls;
// those stay on the admin-only InventoryScreen. The backend already
// enforces this split (adjust-stock is staff+, item create/edit/delete is
// admin-only), so this screen is just exposing what volunteers are already
// allowed to call.
export default function QuickStockScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = category === 'all' || item.category === category;
      const matchesSearch = !query || item.name.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [items, search, category]);

  const load = useCallback(async () => {
    try {
      const data = await api.getItems();
      setItems(data);
    } catch (err) {
      Alert.alert('Could not load inventory', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    getQueueSize().then(setPendingSync);
  }, [load]);

  // Goes through the offline queue (same as tally taps), so handing out
  // supplies keeps working with no signal - the change shows right away and
  // syncs when the phone is back online. It used to call the server
  // directly, so every tap failed with an error out in the field.
  async function adjust(item, delta) {
    setItems((prev) =>
      prev.map((i) => (i._id === item._id ? { ...i, currentStock: Math.max(0, i.currentStock + delta) } : i))
    );
    try {
      // Positive = donation received (not a purchase, so 'adjustment' not
      // 'restock'). Negative = handed out during distribution, tagged
      // 'distributed' so it still feeds the demand forecast.
      await queueAction('adjustStock', {
        itemId: item._id,
        type: delta > 0 ? 'adjustment' : 'distributed',
        quantityDelta: delta,
      });
    } catch (err) {
      Alert.alert('Could not save that change', err.message);
    } finally {
      setPendingSync(await getQueueSize());
    }
  }

  return (
    <Screen scroll={false}>
      <FlatList
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <>
            <Text style={typography.h1} accessibilityRole="header">
              Inventory
            </Text>
            <Text style={[typography.bodyMuted, { marginTop: 4, marginBottom: spacing.md }]}>
              + for supplies donated, − for supplies handed out.
            </Text>

            {pendingSync > 0 && (
              <Card style={{ marginBottom: spacing.md, backgroundColor: colors.background }}>
                <Text style={typography.bodyMuted}>
                  {pendingSync} change{pendingSync === 1 ? '' : 's'} waiting to sync (no connection yet — nothing is lost)
                </Text>
              </Card>
            )}

            <TextInput
              value={search}
              onChangeText={setSearch}
              style={[styles.input, { marginBottom: spacing.sm }]}
              placeholder="Search items…"
              autoCapitalize="none"
            />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
              {CATEGORIES.map((c) => (
                <Button
                  key={c}
                  title={c === 'all' ? 'All' : c[0].toUpperCase() + c.slice(1)}
                  variant={category === c ? 'primary' : 'outline'}
                  onPress={() => setCategory(c)}
                  style={{ marginRight: spacing.xs, marginBottom: spacing.xs, paddingHorizontal: spacing.md, minHeight: 40 }}
                />
              ))}
            </View>
          </>
        }
        data={filteredItems}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) => {
          const isLow = item.currentStock <= item.lowThreshold;
          return (
            <Card style={{ marginBottom: spacing.sm, borderColor: isLow ? colors.danger : colors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[typography.h2, { flexShrink: 1, marginRight: spacing.sm }]}>{item.name}</Text>
                {isLow && <Text style={{ color: colors.danger, fontWeight: '600' }}>LOW</Text>}
              </View>
              <Text style={[typography.bodyMuted, { marginBottom: spacing.sm }]}>
                {item.currentStock} {item.unitType}
                {item.currentStock === 1 ? '' : 's'} in stock
              </Text>

              <View style={{ flexDirection: 'row', marginBottom: spacing.xs }}>
                {STEPS.map((n) => (
                  <Button
                    key={`minus-${n}`}
                    title={`−${n}`}
                    accessibilityLabel={`Remove ${n} ${item.name}`}
                    variant="outline"
                    textColor={colors.danger}
                    disabled={item.currentStock <= 0}
                    onPress={() => adjust(item, -n)}
                    style={{ flex: 1, marginRight: n !== STEPS[STEPS.length - 1] ? spacing.xs : 0, minHeight: 48, borderColor: colors.danger }}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row' }}>
                {STEPS.map((n) => (
                  <Button
                    key={`plus-${n}`}
                    title={`+${n}`}
                    accessibilityLabel={`Add ${n} ${item.name}`}
                    variant="outline"
                    textColor={colors.success}
                    onPress={() => adjust(item, n)}
                    style={{ flex: 1, marginRight: n !== STEPS[STEPS.length - 1] ? spacing.xs : 0, minHeight: 48, borderColor: colors.success }}
                  />
                ))}
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          !loading && (
            <Text style={typography.bodyMuted}>
              {items.length === 0 ? 'No items found.' : 'No items match your search.'}
            </Text>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: inputStyle,
});
