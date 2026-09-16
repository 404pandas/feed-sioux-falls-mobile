import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, FlatList, Linking, Alert, RefreshControl, StyleSheet } from 'react-native';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { colors, spacing, typography, radii } from '../../theme/tokens';
import { api } from '../../api/client';

const CATEGORIES = ['hygiene', 'winter', 'other'];
const FILTER_CATEGORIES = ['all', ...CATEGORIES];

const BLANK_FORM = {
  name: '',
  category: 'hygiene',
  unitCost: '',
  currentStock: '',
  lowThreshold: '',
  unitType: '',
  amazonLink: '',
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
      amazonLink: item.amazonLink || '',
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

    const payload = {
      name: form.name.trim(),
      category: form.category,
      unitType: form.unitType.trim(),
      unitCost: Number(form.unitCost),
      currentStock: form.currentStock === '' ? 0 : Number(form.currentStock),
      lowThreshold: form.lowThreshold === '' ? 0 : Number(form.lowThreshold),
      amazonLink: form.amazonLink.trim() || null,
    };

    setSaving(true);
    try {
      if (editingItem) {
        await api.updateItem(editingItem._id, payload);
      } else {
        await api.createItem(payload);
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

  async function openBuyNow(item) {
    if (!item.amazonLink) {
      Alert.alert('No link set', `Add an Amazon link for "${item.name}" to enable Buy Now.`);
      return;
    }
    // Opens Amazon's app if installed, otherwise the browser. A person still
    // has to tap "Buy" themselves on Amazon - nothing is auto-purchased.
    const canOpen = await Linking.canOpenURL(item.amazonLink);
    if (canOpen) {
      Linking.openURL(item.amazonLink);
    } else {
      Alert.alert('Could not open link', 'The Amazon link for this item looks invalid.');
    }
  }

  return (
    <Screen scroll={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <Text style={typography.h1}>Inventory</Text>
        <Button
          title={showLowStockOnly ? 'Show All' : 'Low Stock Only'}
          variant="outline"
          onPress={() => setShowLowStockOnly((v) => !v)}
        />
      </View>

      {formVisible ? (
        <View style={{ flex: 1 }}>
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.h2, { marginBottom: spacing.md }]}>
              {editingItem ? `Edit "${editingItem.name}"` : 'Add Item'}
            </Text>

            <Text style={styles.label}>Name</Text>
            <TextInput value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} style={styles.input} placeholder="Bar soap (individually wrapped)" />

            <Text style={styles.label}>Category</Text>
            <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
              {CATEGORIES.map((c) => (
                <Button
                  key={c}
                  title={c}
                  variant={form.category === c ? 'primary' : 'outline'}
                  onPress={() => setForm((f) => ({ ...f, category: c }))}
                  style={{ flex: 1, marginRight: c !== CATEGORIES[CATEGORIES.length - 1] ? spacing.xs : 0, minHeight: 40 }}
                />
              ))}
            </View>

            <Text style={styles.label}>Unit type (e.g. "bar", "pair", "bottle")</Text>
            <TextInput value={form.unitType} onChangeText={(v) => setForm((f) => ({ ...f, unitType: v }))} style={styles.input} placeholder="bar" />

            <Text style={styles.label}>Unit cost ($)</Text>
            <TextInput value={form.unitCost} onChangeText={(v) => setForm((f) => ({ ...f, unitCost: v }))} style={styles.input} keyboardType="decimal-pad" placeholder="0.11" />

            <Text style={styles.label}>Current stock</Text>
            <TextInput value={form.currentStock} onChangeText={(v) => setForm((f) => ({ ...f, currentStock: v }))} style={styles.input} keyboardType="number-pad" placeholder="0" />

            <Text style={styles.label}>Low stock threshold</Text>
            <TextInput value={form.lowThreshold} onChangeText={(v) => setForm((f) => ({ ...f, lowThreshold: v }))} style={styles.input} keyboardType="number-pad" placeholder="0" />

            <Text style={styles.label}>Amazon link (optional)</Text>
            <TextInput value={form.amazonLink} onChangeText={(v) => setForm((f) => ({ ...f, amazonLink: v }))} style={styles.input} placeholder="https://www.amazon.com/..." autoCapitalize="none" />

            <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
              <Button title="Cancel" variant="outline" onPress={closeForm} style={{ flex: 1, marginRight: spacing.sm }} />
              <Button title="Save" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
            </View>
          </Card>
        </View>
      ) : (
        <>
          <Button title="+ Add Item" onPress={openCreateForm} style={{ marginBottom: spacing.md }} />

          <TextInput
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

          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item._id}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            renderItem={({ item }) => {
              const isLow = item.currentStock <= item.lowThreshold;
              return (
                <Card style={{ marginBottom: spacing.sm, borderColor: isLow ? colors.danger : colors.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={typography.h2}>{item.name}</Text>
                    {isLow && <Text style={{ color: colors.danger, fontWeight: '600' }}>LOW</Text>}
                  </View>
                  <Text style={typography.bodyMuted}>
                    {item.currentStock} {item.unitType}
                    {item.currentStock === 1 ? '' : 's'} in stock · low threshold {item.lowThreshold}
                  </Text>
                  <Text style={typography.bodyMuted}>${item.unitCost.toFixed(2)} / {item.unitType}</Text>

                  {isLow && item.amazonLink && (
                    <Button title="Buy Now on Amazon" variant="accent" onPress={() => openBuyNow(item)} style={{ marginTop: spacing.sm }} />
                  )}

                  <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
                    <Button title="Edit" variant="outline" onPress={() => openEditForm(item)} style={{ flex: 1, marginRight: spacing.sm, minHeight: 40 }} />
                    <Button title="Delete" variant="outline" onPress={() => confirmDelete(item)} style={{ flex: 1, minHeight: 40, borderColor: colors.danger }} />
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
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.bodyMuted, marginBottom: spacing.xs, marginTop: spacing.sm },
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
