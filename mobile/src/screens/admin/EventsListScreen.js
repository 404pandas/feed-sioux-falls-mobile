import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { colors, spacing, typography } from '../../theme/tokens';
import { api } from '../../api/client';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function dayBounds(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export default function EventsListScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(null); // null = default "past events" view
  const [showPicker, setShowPicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data;
      if (filterDate) {
        const { start, end } = dayBounds(filterDate);
        data = await api.getEvents({ start: start.toISOString(), end: end.toISOString() });
      } else {
        data = await api.getEvents(); // most recent past events, per the backend's default
      }
      setEvents(data);
    } catch (err) {
      Alert.alert('Could not load events', err.message);
    } finally {
      setLoading(false);
    }
  }, [filterDate]);

  // Refetch every time this screen regains focus, not just on first mount -
  // otherwise coming back here after editing an event's details or
  // adjusting its count on EventDetailScreen would keep showing this list's
  // stale snapshot from before that navigation.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function onPickDate(event, selectedDate) {
    setShowPicker(false);
    if (event.type === 'set' && selectedDate) {
      setFilterDate(selectedDate);
    }
  }

  return (
    <Screen scroll={false}>
      <Text style={[typography.h1, { marginBottom: spacing.xs }]}>
        {filterDate ? `Events on ${formatDate(filterDate)}` : 'Past Events'}
      </Text>

      <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
        <Button
          title="Search by Date"
          variant="outline"
          onPress={() => setShowPicker(true)}
          style={{ flex: 1, marginRight: filterDate ? spacing.sm : 0 }}
        />
        {filterDate && (
          <Button title="Clear" variant="outline" onPress={() => setFilterDate(null)} style={{ flex: 1 }} />
        )}
      </View>

      {showPicker && <DateTimePicker value={filterDate || new Date()} mode="date" display="default" onChange={onPickDate} />}

      <FlatList
        data={events}
        keyExtractor={(event) => event._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('EventDetail', { eventId: item._id })}>
            <Card style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={typography.h2}>{formatDate(item.date)}</Text>
                {!item.synced && <Text style={{ color: colors.danger, fontWeight: '600' }}>NOT SYNCED</Text>}
              </View>
              <Text style={typography.bodyMuted}>{item.location}</Text>
              {!!item.details && (
                <Text style={[typography.body, { marginTop: spacing.xs }]} numberOfLines={2}>
                  {item.details}
                </Text>
              )}
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          !loading && (
            <Text style={typography.bodyMuted}>
              {filterDate ? 'No events on this date.' : 'No past events yet.'}
            </Text>
          )
        }
      />
    </Screen>
  );
}
