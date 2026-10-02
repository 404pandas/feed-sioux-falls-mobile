import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { colors, spacing, typography, radii } from '../../theme/tokens';
import { api } from '../../api/client';
import { queueAction, getQueueSize, syncQueue } from '../../utils/offlineQueue';
import { useAuth } from '../../context/AuthContext';

const TALLY_INCREMENTS = [1, 5, 10];
const DEFAULT_START_LOCATION = 'Heritage Park, 330 N Weber Ave, Sioux Falls, SD 57103';

function todayBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export default function VolunteerHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [activeEvent, setActiveEvent] = useState(null);
  const [totalServed, setTotalServed] = useState(0);
  const [pendingSync, setPendingSync] = useState(0);
  const [starting, setStarting] = useState(false);
  const [checkingToday, setCheckingToday] = useState(true);
  const [startLocation, setStartLocation] = useState(DEFAULT_START_LOCATION);
  const [startDetails, setStartDetails] = useState('');
  const [checkError, setCheckError] = useState(false);

  // Lets the AppState listener (set up once on mount) always see the current
  // active event, without needing to re-subscribe every time it changes.
  const activeEventRef = useRef(null);
  useEffect(() => {
    activeEventRef.current = activeEvent;
  }, [activeEvent]);

  // The tally count on screen is bumped optimistically on every tap so it
  // never feels laggy, but that number is purely local and only ever goes
  // up - if a tap's background sync never actually lands, the display
  // would silently stay ahead of what's really recorded. Once the queue is
  // fully drained, pull the real total back from the server so it can't
  // drift and stay wrong (e.g. "End Event" showing a lower count than the
  // tally screen was just displaying).
  const reconcileAfterSync = useCallback(async () => {
    const size = await getQueueSize();
    setPendingSync(size);
    if (size === 0 && activeEventRef.current) {
      try {
        const detail = await api.getEvent(activeEventRef.current._id);
        setTotalServed(detail.totalServed);
      } catch (err) {
        // Couldn't confirm the true total - leave the optimistic value in
        // place rather than showing an error for a background reconcile.
      }
    }
  }, []);

  // Looks for an event already scheduled for today (e.g. the recurring
  // Saturday outreach) and resumes it - pulling its real server-side tally
  // total - instead of always forcing a brand new event. Re-runs every time
  // this screen regains focus (see useFocusEffect below), not just once on
  // mount - React Navigation keeps this screen mounted in the background
  // stack, so without that, coming back from "End Event & Add Notes" (or
  // Inventory, or anywhere else) would keep showing whatever totalServed
  // this screen happened to have before you navigated away, even after an
  // adjustment was already saved to the server.
  const checkTodaysEvent = useCallback(async () => {
    try {
      if (activeEventRef.current) {
        // Already resumed - just refresh its total, don't re-search.
        const detail = await api.getEvent(activeEventRef.current._id);
        setActiveEvent(detail.event);
        setTotalServed(detail.totalServed);
      } else {
        const { start, end } = todayBounds();
        const events = await api.getEvents({ start: start.toISOString(), end: end.toISOString() });
        if (events.length > 0) {
          const detail = await api.getEvent(events[0]._id);
          setActiveEvent(detail.event);
          setTotalServed(detail.totalServed);
        }
      }
      setCheckError(false);
    } catch (err) {
      // Distinguish "couldn't check" from "genuinely nothing scheduled" -
      // silently falling through to the create-new-event form here would
      // risk creating a real duplicate event on a transient network blip.
      setCheckError(true);
    } finally {
      setCheckingToday(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkTodaysEvent();
    }, [checkTodaysEvent])
  );

  useEffect(() => {
    reconcileAfterSync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncQueue().then(reconcileAfterSync);
      }
    });
    return () => sub.remove();
  }, [reconcileAfterSync]);

  async function startEvent() {
    if (!startLocation.trim()) {
      Alert.alert('Location required', 'Enter where this distribution is happening.');
      return;
    }
    setStarting(true);
    try {
      const event = await api.createEvent({ location: startLocation.trim(), details: startDetails.trim() });
      setActiveEvent(event);
      setTotalServed(0);
    } catch (err) {
      Alert.alert('Could not start event', 'Check your connection and try again. ' + err.message);
    } finally {
      setStarting(false);
    }
  }

  async function tap(increment) {
    if (!activeEvent) return;
    setTotalServed((c) => c + increment); // update UI instantly, regardless of connectivity
    await queueAction('tally', { eventId: activeEvent._id, countIncrement: increment });
    reconcileAfterSync();
  }

  if (checkingToday) {
    return (
      <Screen>
        <Text style={typography.body}>Checking today's schedule…</Text>
      </Screen>
    );
  }

  if (!activeEvent && checkError) {
    return (
      <Screen>
        <Text style={typography.h1}>Couldn't check today's schedule</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>
          Check your connection and try again before starting a new event - there may already be
          one scheduled for today.
        </Text>
        <Button title="Retry" onPress={checkTodaysEvent} />
      </Screen>
    );
  }

  if (!activeEvent) {
    return (
      <Screen>
        <Text style={typography.h1}>Hi, {user?.name?.split(' ')[0]}</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>
          Nothing's scheduled for today - fill in where this one's happening to begin counting.
        </Text>

        <Card style={{ marginBottom: spacing.xl }}>
          <Text style={styles.label}>Location</Text>
          <TextInput value={startLocation} onChangeText={setStartLocation} style={styles.input} placeholder="Where is this happening?" />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            value={startDetails}
            onChangeText={setStartDetails}
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Weather, expected turnout, anything worth noting"
            multiline
          />

          <Button title="Start Distribution Event" onPress={startEvent} loading={starting} style={{ marginTop: spacing.md }} />
        </Card>

      </Screen>
    );
  }

  return (
    // Always scrolls now: on smaller phones (and with large text turned on)
    // the bottom buttons used to be pushed off-screen for volunteers.
    <Screen>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View>
          <Text style={typography.h2}>Today's Distribution</Text>
          <Text style={typography.bodyMuted}>{activeEvent.location}</Text>
          {pendingSync > 0 && (
            <Card style={{ marginTop: spacing.md, backgroundColor: colors.background }}>
              <Text style={typography.bodyMuted}>
                {pendingSync} tap{pendingSync === 1 ? '' : 's'} waiting to sync (no connection yet — nothing is lost)
              </Text>
            </Card>
          )}
        </View>

        <View style={{ alignItems: 'center', marginVertical: spacing.lg }} accessibilityLiveRegion="polite">
          <Text style={typography.tallyNumber} accessibilityLabel={`${totalServed} people served so far`}>{totalServed}</Text>
          <Text style={typography.bodyMuted}>people served so far</Text>
        </View>

        <View>
          <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
            {TALLY_INCREMENTS.map((n) => (
              <Button
                key={n}
                title={n === 1 ? '+1 Person Served' : `+${n}`}
                variant="accent"
                onPress={() => tap(n)}
                style={{
                  flex: n === 1 ? 2 : 1,
                  marginRight: n !== TALLY_INCREMENTS[TALLY_INCREMENTS.length - 1] ? spacing.sm : 0,
                  paddingVertical: spacing.xl,
                }}
              />
            ))}
          </View>
          <Button
            title="−1 (fix a mistap)"
            variant="outline"
            textColor={colors.danger}
            disabled={totalServed <= 0}
            onPress={() => tap(-1)}
            style={{ marginBottom: spacing.md, borderColor: colors.danger }}
          />
          <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
            <Button
              title="Adjust Stock"
              variant="outline"
              onPress={() => navigation.navigate('Stock')}
              style={{ flex: 1, marginRight: spacing.sm }}
            />
            <Button title="Survey" variant="outline" onPress={() => navigation.navigate('Survey')} style={{ flex: 1 }} />
          </View>
          {user?.role === 'admin' && (
            <Button
              title="End Event & Add Notes"
              variant="outline"
              onPress={() => navigation.navigate('EventDetail', { eventId: activeEvent._id })}
              style={{ marginBottom: spacing.sm }}
            />
          )}
        </View>

      </View>
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
