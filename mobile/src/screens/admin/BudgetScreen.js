import React, { useEffect, useState, useCallback } from 'react';
import { View, Alert, RefreshControl } from 'react-native';
import Text from '../../components/Text';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import { colors, spacing, typography, radii } from '../../theme/tokens';
import { api } from '../../api/client';

export default function BudgetScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const result = await api.getCurrentBudget();
      setData(result);
    } catch (err) {
      Alert.alert('Could not load budget', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <Screen>
        <Text style={typography.body}>Loading budget…</Text>
      </Screen>
    );
  }

  // Guarded so a month with no budget set yet shows an empty bar instead
  // of NaN% (which drew nothing, or a broken bar on some phones).
  const percentSpent = data.budget.totalBudget > 0
    ? Math.min(100, Math.round((data.amountSpent / data.budget.totalBudget) * 100))
    : data.amountSpent > 0 ? 100 : 0;
  const isOverBudget = data.remaining < 0;

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Text style={typography.h1}>{data.budget.month} Budget</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={typography.bodyMuted}>Remaining</Text>
        <Text style={[typography.tallyNumber, { fontSize: 48, color: isOverBudget ? colors.danger : colors.primary }]}>
          ${data.remaining.toFixed(0)}
        </Text>
        <Text style={typography.bodyMuted}>
          ${data.amountSpent.toFixed(0)} spent of ${data.budget.totalBudget.toFixed(0)}
        </Text>

        <View style={{ height: 10, backgroundColor: colors.border, borderRadius: radii.sm, marginTop: spacing.md, overflow: 'hidden' }}>
          <View
            style={{
              height: '100%',
              width: `${percentSpent}%`,
              backgroundColor: isOverBudget ? colors.danger : colors.accent,
            }}
          />
        </View>
      </Card>

      <Text style={[typography.h2, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>By Category</Text>
      {Object.keys(data.spentByCategory).length === 0 && (
        <Text style={typography.bodyMuted}>Nothing spent yet this month.</Text>
      )}
      {Object.entries(data.spentByCategory).map(([category, amount]) => (
        <Card key={category} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={typography.body}>{category[0].toUpperCase() + category.slice(1)}</Text>
            <Text style={typography.body}>${amount.toFixed(2)}</Text>
          </View>
        </Card>
      ))}

      <Text style={[typography.h2, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>Recent Purchases</Text>
      {data.purchases.length === 0 && <Text style={typography.bodyMuted}>No purchases logged yet.</Text>}
      {data.purchases.slice(0, 10).map((p) => (
        <Card key={p._id} style={{ marginBottom: spacing.sm }}>
          <Text style={typography.body}>{p.item?.name || 'Unknown item'}</Text>
          <Text style={typography.bodyMuted}>
            {p.quantity} × ${(p.quantity ? p.cost / p.quantity : 0).toFixed(2)} = ${p.cost.toFixed(2)}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
