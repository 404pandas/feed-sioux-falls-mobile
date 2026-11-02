import React, { useCallback, useState } from 'react';
import { View, Pressable, Switch, Alert, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { brand, colors, inputStyle, spacing, typography } from '../../theme/tokens';

const ROLES = [
  { key: 'admin', label: 'Admin', plural: 'Admins', sub: 'Everything: budget and receipts, people and logins, messages, notifications, all data.' },
  { key: 'volunteer', label: 'Volunteer', plural: 'Volunteers', sub: 'Count people, inventory +/−, surveys, add receipts, team chat.' },
  { key: 'neighbor', label: 'Neighbor', plural: 'Neighbors', sub: 'Their own login for the public side. No staff tools.' },
];

const BLANK = { name: '', role: 'volunteer', active: true, pin: '' };

// Admins: who can log in, and what they can do. Add people, change their
// role, reset a PIN, or turn off "Can log in" - every change takes effect on
// that person's next tap, and a new PIN logs them out on every phone.
export default function PeopleScreen() {
  const { user } = useAuth();
  const [people, setPeople] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | person (no _id = new)
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPeople((await api.getPeople()).rows);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function open(person) {
    setEditing(person || {});
    setForm(person ? { name: person.name, role: person.role, active: person.active !== false, pin: '' } : BLANK);
  }

  async function save() {
    const isNew = !editing._id;
    if (!form.name.trim()) return Alert.alert('Almost there', 'Enter their name.');
    if ((isNew || form.pin) && !/^\d{4,6}$/.test(form.pin)) return Alert.alert('Check the PIN', 'A PIN is 4 to 6 digits.');
    const body = { name: form.name.trim(), role: form.role, active: form.active };
    if (form.pin) body.pin = form.pin;
    setSaving(true);
    try {
      if (isNew) await api.addPerson(body);
      else await api.updatePerson(editing._id, body);
      setEditing(null);
      load();
      if (form.pin && !isNew) Alert.alert('PIN changed', `${form.name.trim().split(' ')[0]} is logged out everywhere and needs the new PIN to log back in.`);
    } catch (err) {
      Alert.alert('Not saved', err.message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      `Delete ${editing.name}?`,
      'Their login is removed for good. Past counts, receipts, and chat messages stay, but show "Someone" instead of their name.\n\nTo just take access away, turn off "Can log in" instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deletePerson(editing._id);
              setEditing(null);
              load();
            } catch (err) {
              Alert.alert('Could not delete', err.message);
            }
          },
        },
      ]
    );
  }

  if (editing) {
    const isNew = !editing._id;
    const isMe = String(editing._id) === String(user?._id);
    return (
      <Screen>
        <Text style={typography.h1} accessibilityRole="header">
          {isNew ? 'Add a person' : editing.name}
        </Text>

        <Text style={styles.label}>Name</Text>
        <TextInput accessibilityLabel="Name" value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} style={inputStyle} placeholder="First and last name" />
        <Text style={typography.bodyMuted}>This is what they tap on the log in screen.</Text>

        <Text style={styles.label}>Role</Text>
        {ROLES.map((r) => (
          <Pressable
            key={r.key}
            onPress={() => setForm((f) => ({ ...f, role: r.key }))}
            accessibilityRole="radio"
            accessibilityState={{ checked: form.role === r.key }}
            style={[styles.role, form.role === r.key && styles.roleOn]}
          >
            <Text style={{ fontWeight: '700', color: form.role === r.key ? colors.white : colors.text }}>{r.label}</Text>
            <Text style={{ fontSize: 15, color: form.role === r.key ? brand.tealSoft : colors.textMuted }}>{r.sub}</Text>
          </Pressable>
        ))}

        <Text style={styles.label}>{isNew ? 'PIN (4 to 6 digits)' : 'New PIN (leave blank to keep theirs)'}</Text>
        <TextInput accessibilityLabel={editing._id ? 'New PIN' : 'PIN, 4 to 6 digits'}
          value={form.pin}
          onChangeText={(v) => setForm((f) => ({ ...f, pin: v.replace(/\D/g, '').slice(0, 6) }))}
          style={inputStyle}
          keyboardType="number-pad"
          secureTextEntry
          placeholder="••••"
        />
        <Text style={typography.bodyMuted}>
          {isNew ? 'Tell them their PIN in person or by text.' : `A new PIN logs ${isMe ? 'you' : 'them'} out on every phone and computer.`}
        </Text>

        {!isNew && (
          <Pressable
            onPress={() => !isMe && setForm((f) => ({ ...f, active: !f.active }))}
            accessibilityRole="switch"
            accessibilityState={{ checked: form.active, disabled: isMe }}
            style={[styles.switchRow, isMe && { opacity: 0.5 }]}
          >
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Text style={{ fontWeight: '700' }}>Can log in</Text>
              <Text style={typography.bodyMuted}>
                {isMe ? "You can't turn yourself off." : 'Off: logged out right away and hidden from the log in screen. Their history stays.'}
              </Text>
            </View>
            <Switch
              value={form.active}
              disabled={isMe}
              onValueChange={(active) => setForm((f) => ({ ...f, active }))}
              trackColor={{ true: brand.teal, false: '#BDB7AF' }}
              thumbColor={colors.white}
              importantForAccessibility="no"
            />
          </Pressable>
        )}

        <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
          <Button title="Cancel" variant="outline" onPress={() => setEditing(null)} style={{ flex: 1, marginRight: spacing.sm }} />
          <Button title={isNew ? 'Add' : 'Save'} onPress={save} loading={saving} style={{ flex: 1 }} />
        </View>
        {!isNew && !isMe && <Button title="Delete login" icon="trash" variant="outline-danger" onPress={confirmDelete} style={{ marginTop: spacing.lg }} />}
      </Screen>
    );
  }

  const off = (people || []).filter((p) => p.active === false);
  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Text style={typography.h1} accessibilityRole="header">
        People & logins
      </Text>
      <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        Who can log in, and what they can do. Changes take effect right away.
      </Text>
      <Button title="Add a person" icon="plus" onPress={() => open(null)} style={{ marginBottom: spacing.lg }} />

      {!!error && <Text style={[typography.body, { color: colors.danger }]}>{error}</Text>}

      {people &&
        ROLES.map((r) => {
          const list = people.filter((p) => p.role === r.key && p.active !== false);
          if (!list.length) return null;
          return (
            <View key={r.key} style={{ marginBottom: spacing.lg }}>
              <Text style={styles.group}>{r.plural}</Text>
              <Card>
                {list.map((p, i) => (
                  <Row key={p._id} person={p} isMe={String(p._id) === String(user?._id)} first={i === 0} onPress={() => open(p)} />
                ))}
              </Card>
            </View>
          );
        })}

      {off.length > 0 && (
        <View>
          <Text style={styles.group}>Can't log in</Text>
          <Card>
            {off.map((p, i) => (
              <Row key={p._id} person={p} first={i === 0} onPress={() => open(p)} />
            ))}
          </Card>
        </View>
      )}
    </Screen>
  );
}

function Row({ person, isMe, first, onPress }) {
  const role = ROLES.find((r) => r.key === person.role)?.label || person.role;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${person.name}, ${role}. Edit`} style={[styles.row, !first && styles.divider]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700' }}>
          {person.name}
          {isMe ? ' (you)' : ''}
        </Text>
        {person.active === false && <Text style={typography.bodyMuted}>{role} · can't log in</Text>}
      </View>
      <Icon name="chevronRight" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, marginBottom: spacing.xs, marginTop: spacing.lg },
  group: { fontSize: 14, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted, marginBottom: spacing.sm },
  role: { padding: spacing.md, marginBottom: spacing.sm, borderWidth: 2, borderColor: brand.ink, borderRadius: 12, backgroundColor: brand.paper },
  roleOn: { backgroundColor: brand.teal },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, minHeight: 56 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: brand.line },
});
