import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, FlatList, Alert, RefreshControl, StyleSheet } from 'react-native';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { colors, spacing, typography, radii, inputStyle } from '../../theme/tokens';
import { api } from '../../api/client';
import StoreLinksEditor, { ReorderLinks, sourcesForForm, sourcesForSave } from '../../components/StoreLinks';

const CATEGORIES = ['hygiene', 'winter', 'other'];
const FILTER_CATEGORIES = ['all', ...CATEGORIES];

const BLANK_FORM = {
  name: '',
  category: 'hygiene',
  unitCost: '',
  currentStock: '',
  lowThreshold: '',
  unitType: '',
  sources: [],
};

export default function InventoryScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesSearch = !query || item.name.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [items, search, categoryFilter]);

  const [formVisible, setFormVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // null = creating a new item
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getItems(showLowStockOnly);
      setItems(data);
    } catch (err) {
      Alert.alert('Could not load inventory', err.message);
    } finally {
      setLoading(false);
    }
  }, [showLowStockOnly]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreateForm() {
    setEditingItem(null);
    setForm(BLANK_FORM);
    setFormVisible(true);
  }

  function openEditForm(item) {
    setEditingItem(item);
    setForm({
      name: item.name,
      category: item.category,
      unitCost: String(item.unitCost),
      currentStock: String(item.currentStock),
      lowThreshold: String(item.lowThreshold),
      unitType: item.unitType,
      sources: sourcesForForm(item),
    });
    setFormVisible(true);
  }

  function closeForm() {
    setFormVisible(false);
    setEditingItem(null);
    setForm(BLANK_FORM);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.unitType.trim() || form.unitCost === '') {
      Alert.alert('Missing info', 'Name, unit type, and unit cost are required.');
      return;
    }

    const numbers = [form.unitCost, form.currentStock, form.lowThreshold].filter((v) => v !== '');
    if (numbers.some((v) => Number.isNaN(Number(v)) || Number(v) < 0)) {
      Alert.alert('Check the numbers', 'Cost, stock, and threshold need to be numbers of 0 or more.');
      return;
    }

    let sources;
    try {
      sources = sourcesForSave(form.sources);
    } catch (err) {
      Alert.alert('Check the store links', err.message);
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category,
      unitType: form.unitType.trim(),
      unitCost: Number(form.unitCost),
      lowThreshold: form.lowThreshold === '' ? 0 : Number(form.lowThreshold),
      // The server keeps the old single Amazon link in step with these.
      sources,
    };
    // Stock is only set when adding an item. Editing used to send back the
    // number from when the form opened, which erased any +/- taps that
    // synced in the meantime and skipped the inventory history.
    if (!editingItem) payload.currentStock = form.currentStock === '' ? 0 : Number(form.currentStock);

    setSaving(true);
    try {
      // Show the saved item right away, then refresh the whole list.
      if (editingItem) {
        const saved = await api.updateItem(editingItem._id, payload);
        setItems((prev) => prev.map((i) => (i._id === saved._id ? saved : i)));
      } else {
        const saved = await api.createItem(payload);
        setItems((prev) => [...prev, saved]);
      }
      closeForm();
      await load();
    } catch (err) {
      Alert.alert('Could not save item', err.message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(item) {
    Alert.alert(
      'Delete item?',
      `"${item.name}" will be removed from inventory. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
      ]
    );
  }

  async function handleDelete(item) {
    try {
      await api.deleteItem(item._id);
      await load();
    } catch (err) {
      Alert.alert('Could not delete item', err.message);
    }
  }

  // The add/edit form gets its own scrolling screen. It used to sit inside
  // the non-scrolling list layout, so on most phones the lower fields and
  // the Save button were cut off with no way to reach them.
  if (formVisible) {
    return (
      <Screen>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.h2, { marginBottom: spacing.md }]}>
            {editingItem ? `Edit "${editingItem.name}"` : 'Add Item'}
          </Text>

          <Text style={styles.label}>Name</Text>
          <TextInput accessibilityLabel="Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} style={styles.input} placeholder="Bar soap (individually wrapped)" />

          <Text style={styles.label}>Category</Text>
          {/* Sized to their words and wrapping as a group - three equal
              columns broke "Hygiene" and "Winter" mid-word. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm }}>
            {CATEGORIES.map((c) => (
              <Button
                key={c}
                title={c[0].toUpperCase() + c.slice(1)}
                small
                variant={form.category === c ? 'primary' : 'outline'}
                onPress={() => setForm((f) => ({ ...f, category: c }))}
                style={{ marginRight: spacing.xs, marginBottom: spacing.xs }}
              />
            ))}
          </View>

          <Text style={styles.label}>Unit type (e.g. "bar", "pair", "bottle")</Text>
          <TextInput accessibilityLabel="Unit type" value={form.unitType} onChangeText={(v) => setForm((f) => ({ ...f, unitType: v }))} style={styles.input} placeholder="bar" />

          <Text style={styles.label}>Unit cost ($)</Text>
          <TextInput accessibilityLabel="Unit cost, in dollars" value={form.unitCost} onChangeText={(v) => setForm((f) => ({ ...f, unitCost: v }))} style={styles.input} keyboardType="decimal-pad" placeholder="0.11" />

          <Text style={styles.label}>{editingItem ? 'In stock' : 'Starting stock'}</Text>
          {editingItem ? (
            <Text style={typography.body}>
              {editingItem.currentStock} {editingItem.unitType}
              {editingItem.currentStock === 1 ? '' : 's'}. Change it with − and + on the Inventory tab, so it's kept in
              the history.
            </Text>
          ) : (
            <TextInput accessibilityLabel="Starting stock" value={form.currentStock} onChangeText={(v) => setForm((f) => ({ ...f, currentStock: v }))} style={styles.input} keyboardType="number-pad" placeholder="0" />
          )}

          <Text style={styles.label}>Low stock threshold</Text>
          <TextInput accessibilityLabel="Low stock threshold" value={form.lowThreshold} onChangeText={(v) => setForm((f) => ({ ...f, lowThreshold: v }))} style={styles.input} keyboardType="number-pad" placeholder="0" />

          <Text style={[styles.label, { marginTop: spacing.md }]}>Where to buy (optional)</Text>
          <Text style={typography.bodyMuted}>Add Amazon, Temu, or any store. With a price and pack size, the cheapest per unit is marked.</Text>
          <StoreLinksEditor value={form.sources} onChange={(sources) => setForm((f) => ({ ...f, sources }))} />

          <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
            <Button title="Cancel" variant="outline" onPress={closeForm} style={{ flex: 1, marginRight: spacing.sm }} />
            <Button title="Save" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <Text style={typography.h1}>Inventory</Text>
        <Button
          title={showLowStockOnly ? 'Show All' : 'Low Stock Only'}
          variant="outline"
          onPress={() => setShowLowStockOnly((v) => !v)}
          style={{ minHeight: 40, paddingHorizontal: spacing.md }}
        />
      </View>

      {/* Search and filters scroll with the list. When they sat above it,
          they took up most of a small phone's screen and the list itself
          was squeezed into a few lines at the bottom. */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item._id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <>
            <Button title="+ Add Item" onPress={openCreateForm} style={{ marginBottom: spacing.md }} />

            <TextInput accessibilityLabel="Search items"
              value={search}
              onChangeText={setSearch}
              style={[styles.input, { marginBottom: spacing.sm }]}
              placeholder="Search items…"
              autoCapitalize="none"
            />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
              {FILTER_CATEGORIES.map((c) => (
                <Button
                  key={c}
                  title={c === 'all' ? 'All' : c[0].toUpperCase() + c.slice(1)}
                  variant={categoryFilter === c ? 'primary' : 'outline'}
                  onPress={() => setCategoryFilter(c)}
                  style={{ marginRight: spacing.xs, marginBottom: spacing.xs, paddingHorizontal: spacing.md, minHeight: 40 }}
                />
              ))}
            </View>
          </>
        }
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
              <Text style={typography.bodyMuted}>
                {item.currentStock} {item.unitType}
                {item.currentStock === 1 ? '' : 's'} in stock · low threshold {item.lowThreshold}
              </Text>
              <Text style={typography.bodyMuted}>${item.unitCost.toFixed(2)} / {item.unitType}</Text>

              <ReorderLinks item={item} style={{ marginTop: spacing.sm }} />

              <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
                <Button title="Edit" variant="outline" onPress={() => openEditForm(item)} style={{ flex: 1, marginRight: spacing.sm, minHeight: 40 }} />
                <Button title="Delete" variant="outline" onPress={() => confirmDelete(item)} textColor={colors.danger} style={{ flex: 1, minHeight: 40, borderColor: colors.danger }} />
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
  label: { ...typography.bodyMuted, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: inputStyle,
});
