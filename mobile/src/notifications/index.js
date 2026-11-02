import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from '../api/client';

// Push notifications, with a switch for each kind and a privacy mode.
//
// The kinds match the backend (models/PushDevice.js). Each has two Android
// channels: a normal one and a "-private" one kept off the lock screen,
// because Android won't let an app change a channel's lock screen setting
// after it's been made. The server picks the channel to match "Hide what
// notifications say".

export const KINDS = [
  { key: 'outreach', label: 'Outreach reminders', sub: 'Saturday morning before outreach, and changes like bad-weather cancellations.' },
  { key: 'pantry', label: 'Pantry news', sub: 'When the pantry is restocked or something changes.' },
  { key: 'needs', label: '"We need…" requests', sub: 'When an item runs out and could use a donation.' },
  { key: 'staff', label: 'Notices from admins', sub: 'Messages from admins to volunteers.', staffOnly: true },
  { key: 'chat', label: 'Team chat & messages', sub: 'New team chat messages, and messages sent to you.', staffOnly: true },
];

const PREFS_KEY = 'fsf_notification_prefs';
const TOKEN_KEY = 'fsf_push_token';
const REMINDER_ID = 'outreach-reminder';

const DEFAULT_PREFS = {
  // Off until someone turns it on - nobody gets surprised by a notification
  // on a phone someone else might see. Staff are asked once after logging in.
  enabled: false,
  decided: false,
  hideContent: false,
  kinds: { outreach: true, pantry: true, needs: true, staff: true, chat: true },
};

// What "Hide what notifications say" shows instead (same as the server).
const HIDDEN = { title: 'Feed Sioux Falls', body: 'You have a new update' };

// Show notifications even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function loadPrefs() {
  try {
    const saved = JSON.parse(await AsyncStorage.getItem(PREFS_KEY));
    return saved ? { ...DEFAULT_PREFS, ...saved, kinds: { ...DEFAULT_PREFS.kinds, ...saved.kinds } } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

async function savePrefs(prefs) {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
}

let channelsReady = false;
async function ensureChannels() {
  if (Platform.OS !== 'android' || channelsReady) return;
  for (const kind of KINDS) {
    await Notifications.setNotificationChannelAsync(kind.key, {
      name: kind.label,
      description: kind.sub,
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
    await Notifications.setNotificationChannelAsync(`${kind.key}-private`, {
      name: `${kind.label} (hidden)`,
      description: 'Used when "Hide what notifications say" is on. Never shown on the lock screen.',
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
    });
  }
  channelsReady = true;
}

// 'granted', 'blocked' (turned off in the phone's settings - the app can't
// ask again), or 'undetermined'. Android 13+ reports "denied" before the
// app has ever asked, so canAskAgain is what tells "blocked" apart.
export async function getPermission() {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  return canAskAgain === false ? 'blocked' : 'undetermined';
}

// The Saturday reminder is made on the phone itself: it works with no
// signal, without Firebase, and without the server knowing anything.
async function scheduleOutreachReminder(prefs, permitted) {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
  if (!permitted || !prefs.enabled || !prefs.kinds.outreach) return;
  const hidden = prefs.hideContent;
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: hidden ? HIDDEN.title : 'Outreach today, 10–11 am',
      body: hidden ? HIDDEN.body : 'Heritage Park.',
      data: { kind: 'outreach', screen: 'Help' },
    },
    // Saturday (1 = Sunday) at 8:00, phone's local time. Android may hold a
    // scheduled notification up to an hour to save battery, so 8:00 still
    // lands before outreach starts at 10.
    trigger: { weekday: 7, hour: 8, minute: 0, repeats: true, channelId: hidden ? 'outreach-private' : 'outreach' },
  });
}

async function getPushToken() {
  if (!Device.isDevice && Platform.OS === 'ios') return null; // iOS simulators can't get one
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

// Brings the phone, the Saturday reminder, and the server in line with the
// saved switches. Safe to call any time (app start, log in/out, a switch
// changing); never throws. Returns what the settings screen needs to show.
export async function syncNotifications() {
  const prefs = await loadPrefs();
  const result = { prefs, permission: 'undetermined', pushReady: false, error: null };
  try {
    await ensureChannels();
    result.permission = await getPermission();
    const permitted = result.permission === 'granted';
    await scheduleOutreachReminder(prefs, permitted);

    const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
    if (!prefs.enabled || !permitted) {
      // Everything off: tell the server to forget this phone.
      if (savedToken) {
        await api.forgetPushDevice(savedToken);
        await AsyncStorage.removeItem(TOKEN_KEY);
      }
      return result;
    }

    const token = await getPushToken();
    if (!token) return result;
    await api.registerPushDevice({ token, platform: Platform.OS, prefs: prefs.kinds, hideContent: prefs.hideContent });
    await AsyncStorage.setItem(TOKEN_KEY, token);
    result.pushReady = true;
  } catch (err) {
    // Usually no signal, or (in a build without Firebase set up) no push
    // token. The local reminder above still works either way.
    result.error = err.message;
  }
  return result;
}

// The settings screen's switches. Turning the main switch on asks Android
// for permission (once - after that, only the phone's settings can).
export async function updatePrefs(change) {
  const current = await loadPrefs();
  const next = { ...current, ...change, decided: true, kinds: { ...current.kinds, ...(change.kinds || {}) } };
  if (change.enabled) {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') next.enabled = false;
  }
  await savePrefs(next);
  return syncNotifications();
}

// Volunteers and admins are asked once, right after logging in, so staff
// notices and team chat reach them. Anyone can change it after.
export async function offerToStaffOnce() {
  const prefs = await loadPrefs();
  if (prefs.decided) return syncNotifications();
  return updatePrefs({ enabled: true });
}

// Which screen a tapped notification opens: { name, params } or null.
// Staff-only screens are skipped for anyone not logged in as staff.
export function screenForNotification(data, isStaff) {
  const screen = data?.screen;
  if (!screen) return null;
  if (screen === 'Thread') return isStaff && data.threadId ? { name: 'Thread', params: { threadId: data.threadId } } : null;
  if (['TeamChat', 'StaffHome'].includes(screen)) return isStaff ? { name: screen } : null;
  if (['Help', 'Give', 'Home'].includes(screen)) return { name: screen === 'Home' && isStaff ? 'StaffHome' : screen };
  return null;
}
