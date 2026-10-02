import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api } from '../api/client';

const QUEUE_KEY = 'fsf_offline_queue';

// Each queued action looks like: { id, type, payload, timestamp }
// type is one of: 'tally' | 'adjustStock' | 'survey'
// A local id (timestamp + random) is included so retries never double-count -
// the backend doesn't dedupe, but this file only ever sends each queued item
// once and removes it immediately after a confirmed successful response.

async function getQueue() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveQueue(queue) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function makeLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// queueAction and syncQueue both read-modify-write the same AsyncStorage
// queue. Two taps fired close together (e.g. a quick +1 then a correcting
// -1) can otherwise interleave: both read the queue before either saves, and
// whichever saves last silently wins - the other tap is lost, not just
// delayed. Funneling every queue-touching operation through this one chain
// guarantees they run strictly one at a time, in the order they were
// requested, no matter how fast they fire.
let taskChain = Promise.resolve();
function runSerially(task) {
  const result = taskChain.then(task, task);
  taskChain = result.catch(() => {}); // a rejection here must not wedge the chain
  return result;
}

// 4xx responses other than "log in again" (401), "timed out" (408) and
// "slow down" (429) mean the request itself will never be accepted.
function isPermanentFailure(err) {
  return typeof err.status === 'number' && err.status >= 400 && err.status < 500 && ![401, 408, 429].includes(err.status);
}

async function attemptSync(startingQueue) {
  const net = await NetInfo.fetch();
  if (!net.isConnected) return { synced: 0, remaining: startingQueue.length };

  let queue = startingQueue;
  let syncedCount = 0;

  // Oldest first, so tallies from earlier in the day land before later ones
  // - matters for any future time-based analysis.
  for (const item of [...queue]) {
    try {
      if (item.type === 'tally') {
        await api.tally(item.payload.eventId, {
          countIncrement: item.payload.countIncrement,
          timestamp: item.timestamp,
        });
      } else if (item.type === 'adjustStock') {
        await api.adjustStock(item.payload.itemId, item.payload);
      } else if (item.type === 'survey') {
        await api.submitSurvey(item.payload);
      }

      queue = queue.filter((q) => q.id !== item.id);
      await saveQueue(queue);
      syncedCount += 1;
    } catch (err) {
      if (isPermanentFailure(err)) {
        // The server looked at this one and said no for good (bad data, or
        // the item/event was deleted). Retrying can never work, and leaving
        // it at the front of the queue used to block every tap behind it
        // forever - so drop just this one and keep going.
        queue = queue.filter((q) => q.id !== item.id);
        await saveQueue(queue);
        continue;
      }
      // No signal, server down, or logged out: leave it (and everything
      // after it) queued and stop - retry the whole remaining queue next
      // time rather than skipping ahead and risking out-of-order writes.
      break;
    }
  }

  return { synced: syncedCount, remaining: queue.length };
}

// Call this from any screen action instead of calling the API directly, for
// anything that needs to work offline (tally taps, stock adjustments).
export function queueAction(type, payload) {
  return runSerially(async () => {
    const queue = await getQueue();
    const item = { id: makeLocalId(), type, payload, timestamp: Date.now() };
    queue.push(item);
    await saveQueue(queue);

    // Wait for the sync attempt (not just fire it and move on) so that by
    // the time this resolves, the queue - and anything reading its size
    // right after - reflects reality. If offline, the NetInfo check inside
    // attemptSync returns immediately, so this doesn't add latency then.
    await attemptSync(queue);

    return item;
  });
}

// Attempts to push every queued item to the server. See attemptSync for the
// actual sync behavior - this just grabs the current queue under the same
// serialization guarantee as queueAction.
export function syncQueue() {
  return runSerially(async () => attemptSync(await getQueue()));
}

export async function getQueueSize() {
  return (await getQueue()).length;
}

// Call this once when the app starts, and again whenever connectivity
// changes from offline to online.
export function startAutoSync() {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      syncQueue();
    }
  });
}
