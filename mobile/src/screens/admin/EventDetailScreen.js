import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ScrollView } from 'react-native';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { colors, spacing, typography, radii } from '../../theme/tokens';
import { api } from '../../api/client';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EventDetailScreen({ route, navigation }) {
  const { eventId } = route.params;

  const [event, setEvent] = useState(null);
  const [totalServed, setTotalServed] = useState(0);
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [adjusting, setAdjusting] = useState(false);
  const [adjustedTotal, setAdjustedTotal] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getEvent(eventId);
      setEvent(data.event);
      setTotalServed(data.totalServed);
      setLocation(data.event.location || '');
      setDetails(data.event.details || '');
    } catch (err) {
      Alert.alert('Could not load event', err.message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.updateEvent(eventId, { location, details });
      setEvent(updated);
      Alert.alert('Saved', 'Event details updated.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not save', err.message);
    } finally {
      setSaving(false);
    }
  }

  function openAdjustForm() {
    setAdjustedTotal(String(totalServed));
    setAdjusting(true);
  }

  async function handleSaveAdjustment() {
    const newTotal = Number(adjustedTotal);
    if (!Number.isInteger(newTotal) || newTotal < 0) {
      Alert.alert('Invalid count', 'Enter a whole number of 0 or more.');
      return;
    }

    const delta = newTotal - totalServed;
    if (delta === 0) {
      setAdjusting(false);
      return;
    }

    setAdjustSaving(true);
    try {
      // Reuses the same tally endpoint every live tap goes through - this
      // adjustment is just one more (possibly negative) tally row, so the
      // event's history stays a straightforward sum, not a separately
      // tracked "corrected" value.
      await api.tally(eventId, { countIncrement: delta });
      await load(); // pull the server's recomputed total back, not just trust our own math
      setAdjusting(false);
      Alert.alert('Count updated', `Adjusted from ${totalServed} to ${newTotal}.`);
    } catch (err) {
      Alert.alert('Could not adjust count', err.message);
    } finally {
      setAdjustSaving(false);
    }
  }

  if (loading || !event) {
    return (
      <View style={{ flex: 1, padding: spacing.lg, backgroundColor: colors.background }}>
        <Text style={typography.body}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={typography.h1}>{formatDate(event.date)}</Text>

      <Card style={{ marginTop: spacing.lg, marginBottom: spacing.sm, alignItems: 'center' }}>
        <Text style={typography.tallyNumber}>{totalServed}</Text>
        <Text style={typography.bodyMuted}>people served</Text>
      </Card>

      {adjusting ? (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={typography.body}>Do you want to adjust the count from {totalServed}?</Text>
          <TextInput
            value={adjustedTotal}
            onChangeText={setAdjustedTotal}
            style={[styles.input, { marginTop: spacing.sm }]}
            keyboardType="number-pad"
            placeholder={String(totalServed)}
          />
          <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
            <Button title="Cancel" variant="outline" onPress={() => setAdjusting(false)} style={{ flex: 1, marginRight: spacing.sm }} />
            <Button title="Save Adjustment" onPress={handleSaveAdjustment} loading={adjustSaving} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : (
        <Button title="Adjust Count" variant="outline" onPress={openAdjustForm} style={{ marginBottom: spacing.lg }} />
      )}

      <Text style={styles.label}>Location</Text>
      <TextInput value={location} onChangeText={setLocation} style={styles.input} />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        value={details}
        onChangeText={setDetails}
        style={[styles.input, { height: 140, textAlignVertical: 'top' }]}
        placeholder="Total guests, weather, what ran out, anything worth remembering…"
        multiline
      />

      <Button title="Save" onPress={handleSave} loading={saving} style={{ marginTop: spacing.lg }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.bodyMuted, marginBottom: spacing.xs, marginTop: spacing.md },
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
