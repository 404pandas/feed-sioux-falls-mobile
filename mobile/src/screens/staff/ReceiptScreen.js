import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, Image, Pressable, Alert, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { api, authHeaders } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { getReceiptPhoto, scanReceipt, shareReceiptPhoto } from '../../receipts/photos';
import { COMMON_STORES, RECEIPT_CATEGORIES, categoryLabel, formatDay, money, todayString } from '../../receipts/categories';
import { brand, colors, inputStyle, spacing, typography } from '../../theme/tokens';

function toDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Add a receipt (any volunteer or admin), or open one to see it - admins
// can fix or delete it. Snap a photo and the phone reads the store, date,
// total, and likely items; or skip the photo and type it in. The photo is
// saved with the receipt so the paper can go.
export default function ReceiptScreen({ route, navigation }) {
  const existing = route.params?.receipt || null;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const editable = !existing || isAdmin;

  const [photo, setPhoto] = useState(null); // a new photo: { uri, base64, contentType }
  const [keepPhoto, setKeepPhoto] = useState(!!existing?.hasPhoto);
  const [photoHeaders, setPhotoHeaders] = useState(null);
  const [scanNote, setScanNote] = useState('');
  const [scanning, setScanning] = useState(false);

  const [store, setStore] = useState(existing?.store || '');
  const [date, setDate] = useState(existing ? String(existing.date).slice(0, 10) : todayString());
  const [total, setTotal] = useState(existing ? String(existing.total) : '');
  const [category, setCategory] = useState(existing?.category || 'other');
  const [note, setNote] = useState(existing?.note || '');
  const [showDate, setShowDate] = useState(false);

  const [items, setItems] = useState([]);
  const [lines, setLines] = useState([]); // [{ item, quantity }] - new receipts only
  const [suggestions, setSuggestions] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? (editable ? 'Edit receipt' : 'Receipt') : 'Add a receipt' });
  }, [navigation, existing, editable]);

  useEffect(() => {
    if (existing?.hasPhoto) authHeaders().then(setPhotoHeaders);
    if (!existing) api.getItems().then(setItems).catch(() => {});
  }, [existing]);

  async function addPhoto(source) {
    const picked = await getReceiptPhoto(source);
    if (!picked) return;
    setPhoto(picked);
    setKeepPhoto(false);
    setScanning(true);
    setScanNote('');
    const found = await scanReceipt(picked.uri, items);
    setScanning(false);
    if (!found || (!found.store && !found.date && found.total == null)) {
      setScanNote("Couldn't read this photo. It's still saved - type the details below.");
      return;
    }
    // Only fill in what's still empty, so a photo never overwrites typing.
    if (found.store && !store.trim()) setStore(found.store);
    if (found.date && (!existing || date === todayString())) setDate(found.date);
    if (found.total != null && !total.trim()) setTotal(found.total.toFixed(2));
    if (!existing) setSuggestions(found.suggestions.filter((s) => !lines.some((l) => l.item._id === s.item._id)));
    setScanNote('Filled in from the photo. Check it before saving.');
  }

  function addLine(item, quantity = 1) {
    setLines((prev) => (prev.some((l) => l.item._id === item._id) ? prev : [...prev, { item, quantity: Math.max(1, quantity) }]));
    setSuggestions((prev) => prev.filter((s) => s.item._id !== item._id));
    setItemSearch('');
  }

  function setLineQuantity(itemId, quantity) {
    setLines((prev) => prev.map((l) => (l.item._id === itemId ? { ...l, quantity: Math.max(1, quantity) } : l)));
  }

  const searchResults = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return [];
    return items.filter((i) => i.name.toLowerCase().includes(q) && !lines.some((l) => l.item._id === i._id)).slice(0, 6);
  }, [itemSearch, items, lines]);

  async function save() {
    if (!store.trim()) return Alert.alert('Almost there', 'Enter the store.');
    if (total.trim() === '' || Number.isNaN(Number(total)) || Number(total) < 0) return Alert.alert('Almost there', 'Enter the total as a number.');
    const payload = { store: store.trim(), date, total: Number(total), category, note: note.trim() };
    if (photo) payload.photo = { base64: photo.base64, contentType: photo.contentType };
    setSaving(true);
    try {
      if (existing) {
        if (!photo && existing.hasPhoto && !keepPhoto) payload.removePhoto = true;
        await api.updateReceipt(existing._id, payload);
      } else {
        payload.lines = lines.map((l) => ({ itemId: l.item._id, quantity: l.quantity }));
        await api.createReceipt(payload);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Not saved', err.message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete this receipt?', `${existing.store}, ${money(existing.total)}. It comes off the budget, and its photo is deleted. Any stock it added stays.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteReceipt(existing._id);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Could not delete', err.message);
          }
        },
      },
    ]);
  }

  async function share() {
    try {
      await shareReceiptPhoto({ ...existing, store, date, total: Number(total) });
    } catch (err) {
      Alert.alert('Could not share', err.message);
    }
  }

  const photoSource = photo ? { uri: photo.uri } : keepPhoto && photoHeaders ? { uri: api.receiptPhotoUrl(existing._id), headers: photoHeaders } : null;

  // Read-only view (volunteers opening a receipt someone saved).
  if (!editable) {
    return (
      <Screen>
        {photoSource && <Image source={photoSource} style={styles.photo} resizeMode="contain" accessibilityLabel="Receipt photo" />}
        <Text style={typography.h1}>{existing.store}</Text>
        <Text style={[typography.h2, { marginTop: spacing.xs }]}>{money(existing.total)}</Text>
        <Text style={typography.bodyMuted}>
          {formatDay(existing.date)} · {categoryLabel(existing.category)} · added by {existing.uploadedBy?.name || 'someone'}
        </Text>
        {!!existing.note && <Text style={[typography.body, { marginTop: spacing.sm }]}>{existing.note}</Text>}
        {existing.lines?.length > 0 && (
          <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>
            Restocked: {existing.lines.map((l) => `${l.name} ×${l.quantity}`).join(', ')}
          </Text>
        )}
        {existing.hasPhoto && <Button title="Download photo" icon="external" variant="outline" onPress={share} style={{ marginTop: spacing.lg }} />}
      </Screen>
    );
  }

  return (
    <Screen>
      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h2, { marginBottom: spacing.xs }]}>Photo</Text>
        {photoSource ? (
          <>
            <Image source={photoSource} style={styles.photo} resizeMode="contain" accessibilityLabel="Receipt photo" />
            {scanning && <Text style={typography.bodyMuted}>Reading the receipt…</Text>}
            {!!scanNote && <Text style={[typography.body, { fontWeight: '700' }]}>{scanNote}</Text>}
            <View style={styles.wrapRow}>
              <Button title="Retake" small variant="outline" onPress={() => addPhoto('camera')} style={styles.chip} />
              {existing?.hasPhoto && !photo && <Button title="Download" small variant="outline" icon="external" onPress={share} style={styles.chip} />}
              <Button
                title="Remove photo"
                small
                variant="outline-danger"
                onPress={() => {
                  setPhoto(null);
                  setKeepPhoto(false);
                  setScanNote('');
                }}
                style={styles.chip}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={[typography.bodyMuted, { marginBottom: spacing.sm }]}>
              Optional. The phone reads the store, date, and total for you, and the photo is saved so the paper can be
              thrown away.
            </Text>
            <View style={styles.wrapRow}>
              <Button title="Take a photo" small onPress={() => addPhoto('camera')} style={styles.chip} />
              <Button title="Choose a photo" small variant="outline" onPress={() => addPhoto('library')} style={styles.chip} />
            </View>
          </>
        )}
      </Card>

      <Text style={styles.label}>Store</Text>
      <TextInput accessibilityLabel="Store" value={store} onChangeText={setStore} style={inputStyle} placeholder="Where it was bought" maxLength={100} />
      <View style={[styles.wrapRow, { marginTop: spacing.xs }]}>
        {COMMON_STORES.map((s) => (
          <Button key={s} title={s} small variant={store === s ? 'primary' : 'outline'} onPress={() => setStore(s)} style={styles.chip} />
        ))}
      </View>

      <Text style={styles.label}>Date on the receipt</Text>
      <Button title={formatDay(date)} icon="calendar" variant="outline" onPress={() => setShowDate(true)} style={{ alignSelf: 'flex-start' }} />
      {showDate && (
        <DateTimePicker
          value={new Date(`${date}T12:00:00`)}
          mode="date"
          maximumDate={new Date()}
          onChange={(e, picked) => {
            setShowDate(false);
            if (e.type === 'set' && picked) setDate(toDateString(picked));
          }}
        />
      )}

      <Text style={styles.label}>Total ($)</Text>
      <TextInput accessibilityLabel="Total, in dollars" value={total} onChangeText={setTotal} style={inputStyle} keyboardType="decimal-pad" placeholder="0.00" />

      <Text style={styles.label}>What it was for</Text>
      <View style={styles.wrapRow}>
        {RECEIPT_CATEGORIES.map((c) => (
          <Button key={c.key} title={c.label} small variant={category === c.key ? 'primary' : 'outline'} onPress={() => setCategory(c.key)} style={styles.chip} />
        ))}
      </View>
      {category === 'operations' && <Text style={typography.bodyMuted}>{RECEIPT_CATEGORIES[3].sub}</Text>}

      <Text style={styles.label}>Note (optional)</Text>
      <TextInput accessibilityLabel="Note" value={note} onChangeText={setNote} style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]} multiline maxLength={500} placeholder="What it was for, who paid, anything the bookkeeper should know" />

      {existing ? (
        existing.lines?.length > 0 && (
          <Text style={[typography.bodyMuted, { marginTop: spacing.md }]}>
            Restocked when saved: {existing.lines.map((l) => `${l.name} ×${l.quantity}`).join(', ')}. Fix stock with − and + on the
            Inventory tab.
          </Text>
        )
      ) : (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={typography.h2}>Add to inventory (optional)</Text>
          <Text style={[typography.bodyMuted, { marginBottom: spacing.sm }]}>
            Items from this trip that should go into stock. Skip this for gas, bins, and other non-inventory buys.
          </Text>

          {suggestions.length > 0 && (
            <>
              <Text style={[typography.label, { marginBottom: spacing.xs }]}>Looks like it might include</Text>
              {suggestions.map((s) => (
                <Pressable key={s.item._id} onPress={() => addLine(s.item, s.quantity)} accessibilityRole="button" style={styles.suggestion}>
                  <Text style={{ fontWeight: '700' }}>
                    + {s.item.name} ×{s.quantity}
                  </Text>
                  <Text style={typography.bodyMuted} numberOfLines={1}>
                    From "{s.line}"
                  </Text>
                </Pressable>
              ))}
            </>
          )}

          {lines.map((l) => (
            <View key={l.item._id} style={styles.line}>
              <Text style={{ flex: 1, marginRight: spacing.sm }}>{l.item.name}</Text>
              <Button title="−" small variant="outline" onPress={() => setLineQuantity(l.item._id, l.quantity - 1)} accessibilityLabel={`One less ${l.item.name}`} />
              <TextInput
                value={String(l.quantity)}
                onChangeText={(v) => setLineQuantity(l.item._id, Number(v.replace(/\D/g, '')) || 1)}
                keyboardType="number-pad"
                style={[inputStyle, styles.qty]}
                accessibilityLabel={`How many ${l.item.name}`}
              />
              <Button title="+" small variant="outline" onPress={() => setLineQuantity(l.item._id, l.quantity + 1)} accessibilityLabel={`One more ${l.item.name}`} />
              <Pressable onPress={() => setLines((prev) => prev.filter((x) => x.item._id !== l.item._id))} hitSlop={8} accessibilityLabel={`Remove ${l.item.name}`} style={{ marginLeft: spacing.sm }}>
                <Text style={{ color: colors.danger, fontWeight: '700' }}>✕</Text>
              </Pressable>
            </View>
          ))}

          <TextInput accessibilityLabel="Search items to add" value={itemSearch} onChangeText={setItemSearch} style={[inputStyle, { marginTop: spacing.sm }]} placeholder="Search items to add…" autoCapitalize="none" />
          {searchResults.map((i) => (
            <Pressable key={i._id} onPress={() => addLine(i)} accessibilityRole="button" style={styles.result}>
              <Text>+ {i.name}</Text>
            </Pressable>
          ))}
        </Card>
      )}

      <Button title={existing ? 'Save changes' : 'Save receipt'} onPress={save} loading={saving} style={{ marginTop: spacing.lg }} />
      {existing && isAdmin && (
        <Button title="Delete receipt" variant="outline-danger" icon="trash" onPress={confirmDelete} style={{ marginTop: spacing.md }} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, marginBottom: spacing.xs, marginTop: spacing.md },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { marginRight: spacing.xs, marginBottom: spacing.xs },
  photo: { width: '100%', height: 320, marginVertical: spacing.sm, backgroundColor: brand.mist },
  suggestion: { padding: spacing.sm, marginBottom: spacing.xs, borderWidth: 2, borderColor: brand.teal, borderRadius: 12, borderStyle: 'dashed' },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: brand.line },
  qty: { minWidth: 64, marginHorizontal: spacing.xs, paddingVertical: 6, textAlign: 'center' },
  result: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: brand.line },
});
