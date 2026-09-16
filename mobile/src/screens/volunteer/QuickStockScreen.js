import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, FlatList, Alert, RefreshControl, StyleSheet } from 'react-native';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { colors, spacing, typography, radii } from '../../theme/tokens';
import { api } from '../../api/client';

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
  const [busyId, setBusyId] = useState(null);
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
  }, [load]);

  async function adjust(item, delta) {
    setBusyId(item._id);
    try {
      // Positive = donation received (not a purchase, so 'adjustment' not
      // 'restock'). Negative = handed out during distribution, tagged
      // 'distributed' so it still feeds the demand forecast.
      const { item: updated } = await api.adjustStock(item._id, {
        type: delta > 0 ? 'adjustment' : 'distributed',
        quantityDelta: delta,
      });
      setItems((prev) => prev.map((i) => (i._id === updated._id ? updated : i)));
    } catch (err) {
      Alert.alert('Could not update stock', err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen scroll={false}>
      <Text style={[typography.h1, { marginBottom: spacing.xs }]}>Adjust Inventory</Text>
      <Text style={[typography.bodyMuted, { marginBottom: spacing.md }]}>
        + for supplies donated, − for supplies handed out.
      </Text>

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

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) => {
          const isLow = item.currentStock <= item.lowThreshold;
          const isBusy = busyId === item._id;
          return (
            <Card style={{ marginBottom: spacing.sm, borderColor: isLow ? colors.danger : colors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={typography.h2}>{item.name}</Text>
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
                    title={`-${n}`}
                    variant="outline"
                    disabled={isBusy}
                    onPress={() => adjust(item, -n)}
                    style={{ flex: 1, marginRight: spacing.xs, minHeight: 40, borderColor: colors.danger }}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row' }}>
                {STEPS.map((n) => (
                  <Button
                    key={`plus-${n}`}
                    title={`+${n}`}
                    variant="outline"
                    disabled={isBusy}
                    onPress={() => adjust(item, n)}
                    style={{ flex: 1, marginRight: spacing.xs, minHeight: 40, borderColor: colors.success }}
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
});
