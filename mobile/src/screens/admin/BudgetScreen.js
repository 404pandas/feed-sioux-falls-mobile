import React, { useCallback, useState } from 'react';
import { View, Pressable, Alert, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { shareReceiptsCsv } from '../../receipts/photos';
import { categoryLabel, formatDay, money, monthKey } from '../../receipts/categories';
import { brand, colors, inputStyle, radii, spacing, typography } from '../../theme/tokens';

function shiftMonth(month, by) {
  const [y, m] = month.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + by, 1));
}

function monthName(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Budget and receipts, one month at a time. Anyone on staff can add a
// receipt; admins can change the month's budget, fix or delete receipts,
// and export the month for the bookkeeper (QuickBooks).
export default function BudgetScreen({ navigation }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const thisMonth = monthKey();
  const [month, setMonth] = useState(thisMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingBudget, setEditingBudget] = useState(null); // text while editing
  const [savingBudget, setSavingBudget] = useState(false);
  const [storage, setStorage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.getBudgetMonth(month));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    if (isAdmin) api.getReceiptStorage().then(setStorage).catch(() => {});
  }, [month, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function saveBudget() {
    const value = Number(editingBudget);
    if (editingBudget.trim() === '' || Number.isNaN(value) || value < 0) {
      Alert.alert('Check the number', 'Enter the budget as a number of 0 or more.');
      return;
    }
    setSavingBudget(true);
    try {
      await api.setBudgetMonth(month, value);
      setEditingBudget(null);
      load();
    } catch (err) {
      Alert.alert('Not saved', err.message);
    } finally {
      setSavingBudget(false);
    }
  }

  async function exportCsv() {
    try {
      await shareReceiptsCsv(month);
    } catch (err) {
      Alert.alert('Could not export', err.message);
    }
  }

  const total = data?.budget.totalBudget || 0;
  const percentSpent = total > 0 ? Math.min(100, Math.round((data.amountSpent / total) * 100)) : data?.amountSpent > 0 ? 100 : 0;
  const isOver = data && data.remaining < 0;

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <View style={styles.monthRow}>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={10} style={styles.arrow}>
          <Icon name="chevronLeft" size={28} />
        </Pressable>
        <Text style={[typography.h1, { flex: 1, textAlign: 'center' }]} accessibilityRole="header">
          {monthName(month)}
        </Text>
        <Pressable
          onPress={() => month < thisMonth && setMonth(shiftMonth(month, 1))}
          disabled={month >= thisMonth}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={10}
          style={[styles.arrow, month >= thisMonth && { opacity: 0.25 }]}
        >
          <Icon name="chevronRight" size={28} />
        </Pressable>
      </View>

      <Button title="Add a receipt" icon="plus" variant="accent" onPress={() => navigation.navigate('Receipt')} style={{ marginBottom: spacing.lg }} />

      {!!error && !data && <Text style={[typography.body, { color: colors.danger }]}>{error}</Text>}

      {data && (
        <>
          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={typography.bodyMuted}>Left to spend</Text>
            <Text style={[typography.tallyNumber, { fontSize: 48, lineHeight: 56, color: isOver ? colors.danger : colors.primary }]}>
              {money(data.remaining)}
            </Text>
            <Text style={typography.bodyMuted}>
              {money(data.amountSpent)} spent of {money(total)}
              {data.isDefault ? ' (the usual budget)' : ''}
            </Text>
            <View style={styles.track}>
              <View style={{ height: '100%', width: `${percentSpent}%`, backgroundColor: isOver ? colors.danger : colors.accent }} />
            </View>

            {isAdmin &&
              (editingBudget === null ? (
                <Button title="Change budget" icon="edit" small variant="outline" onPress={() => setEditingBudget(String(total))} style={{ alignSelf: 'flex-start', marginTop: spacing.md }} />
              ) : (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={[typography.label, { marginBottom: spacing.xs }]}>Budget for {monthName(month)} ($)</Text>
                  <TextInput value={editingBudget} onChangeText={setEditingBudget} keyboardType="decimal-pad" style={inputStyle} autoFocus />
                  <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
                    <Button title="Cancel" small variant="outline" onPress={() => setEditingBudget(null)} style={{ marginRight: spacing.sm }} />
                    <Button title="Save" small onPress={saveBudget} loading={savingBudget} />
                  </View>
                </View>
              ))}
          </Card>

          {Object.keys(data.spentByCategory).length > 0 && (
            <>
              <Text style={[typography.h2, { marginBottom: spacing.sm }]}>By category</Text>
              <Card style={{ marginBottom: spacing.lg }}>
                {Object.entries(data.spentByCategory).map(([cat, amount], i) => (
                  <View key={cat} style={[styles.catRow, i > 0 && styles.divider]}>
                    <Text>{categoryLabel(cat)}</Text>
                    <Text style={{ fontWeight: '700' }}>{money(amount)}</Text>
                  </View>
                ))}
              </Card>
            </>
          )}

          <Text style={[typography.h2, { marginBottom: spacing.sm }]}>Receipts</Text>
          {data.receipts.length === 0 && <Text style={[typography.bodyMuted, { marginBottom: spacing.lg }]}>No receipts for this month yet.</Text>}
          {data.receipts.map((r) => (
            <Pressable key={r._id} onPress={() => navigation.navigate('Receipt', { receipt: r })} accessibilityRole="button" style={{ marginBottom: spacing.sm }}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '700', flexShrink: 1, marginRight: spacing.sm }}>{r.store}</Text>
                  <Text style={{ fontWeight: '700' }}>{money(r.total)}</Text>
                </View>
                <Text style={typography.bodyMuted}>
                  {formatDay(r.date)} · {categoryLabel(r.category)}
                  {r.hasPhoto ? ' · photo' : ''} · {r.uploadedBy?.name || 'someone'}
                </Text>
              </Card>
            </Pressable>
          ))}

          {data.purchases.length > 0 && (
            <>
              <Text style={[typography.h2, { marginTop: spacing.md, marginBottom: spacing.sm }]}>Single-item purchases</Text>
              {data.purchases.map((p) => (
                <Card key={p._id} style={{ marginBottom: spacing.sm }}>
                  <Text>{p.item?.name || 'Unknown item'}</Text>
                  <Text style={typography.bodyMuted}>
                    {formatDay(p.date)} · {p.quantity} for {money(p.cost)}
                  </Text>
                </Card>
              ))}
            </>
          )}

          {isAdmin && (
            <Card style={{ marginTop: spacing.lg, backgroundColor: brand.coinSoft }}>
              <Text style={[typography.h2, { marginBottom: spacing.xs }]}>For the bookkeeper</Text>
              <Text style={[typography.bodyMuted, { marginBottom: spacing.sm }]}>
                A spreadsheet of this month's receipts (date, payee, amount, category, memo, photo file name). Open a
                receipt to download its photo for QuickBooks.
              </Text>
              <Button title="Export month (CSV)" icon="external" small variant="outline" onPress={exportCsv} style={{ alignSelf: 'flex-start' }} />
              {storage && (
                <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>
                  {storage.photos} receipt photo{storage.photos === 1 ? '' : 's'} saved, using {(storage.bytes / 1048576).toFixed(1)} MB of
                  about 400 MB available.
                </Text>
              )}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  track: { height: 10, backgroundColor: brand.line, borderRadius: radii.sm, marginTop: spacing.md, overflow: 'hidden' },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: brand.line },
});
