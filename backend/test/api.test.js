// End-to-end checks for the API: the routes the current mobile app and
// website already use (so updates can't quietly break them), plus the
// public summary and admin Data routes.
//
// Needs a THROWAWAY MongoDB - it wipes the database it's pointed at.
//   MONGODB_URI_TEST=mongodb://127.0.0.1:27017/fsf_test npm test
// (Running against FerretDB instead of MongoDB? Also set TEST_DB_IS_FERRET=1.)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.PUSH_DRY_RUN = '1'; // never send real pushes from tests
const URI = process.env.MONGODB_URI_TEST;
if (!URI || /prod|atlas|mongodb\+srv/i.test(URI)) {
  console.error('Set MONGODB_URI_TEST to a local throwaway database (it gets wiped).');
  process.exit(1);
}

const app = require('../src/server');
const User = require('../src/models/User');
const HistoricalEstimate = require('../src/models/HistoricalEstimate');

let server;
let base;
const tokens = {};
const ids = {};

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function makeUser(name, role, pin) {
  const user = new User({ name, role });
  await user.setPin(pin);
  await user.save();
  return user;
}

before(async () => {
  await mongoose.connect(URI);
  await mongoose.connection.db.dropDatabase();
  ids.admin = (await makeUser('Ada Admin', 'admin', '1111'))._id;
  ids.volunteer = (await makeUser('Val Volunteer', 'volunteer', '2222'))._id;
  ids.neighbor = (await makeUser('Ned Neighbor', 'neighbor', '3333'))._id;
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
});

test('login picker and PIN login still work', async () => {
  const names = await call('GET', '/api/auth/names');
  assert.equal(names.status, 200);
  assert.equal(names.data.length, 3);
  assert.ok(names.data.every((u) => !('pinHash' in u)));

  for (const [role, pin] of [['admin', '1111'], ['volunteer', '2222'], ['neighbor', '3333']]) {
    const r = await call('POST', '/api/auth/login', { body: { userId: String(ids[role]), pin } });
    assert.equal(r.status, 200, `${role} login`);
    tokens[role] = r.data.token;
  }
  const bad = await call('POST', '/api/auth/login', { body: { userId: String(ids.admin), pin: '9999' } });
  assert.equal(bad.status, 401);
});

test('old app item routes: create with amazonLink, edit, Buy Now link', async () => {
  const created = await call('POST', '/api/items', {
    token: tokens.admin,
    body: { name: 'Socks', category: 'winter', unitCost: 0.5, unitType: 'pair', currentStock: 3, lowThreshold: 10, amazonLink: 'https://amazon.com/socks' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.amazonLink, 'https://amazon.com/socks');
  assert.deepEqual(created.data.sources.map((s) => s.store), ['amazon']);
  ids.socks = created.data._id;

  // The old app's edit form sends every field, including amazonLink.
  const edited = await call('PATCH', `/api/items/${ids.socks}`, {
    token: tokens.admin,
    body: { name: 'Socks (crew)', category: 'winter', unitCost: 0.5, unitType: 'pair', currentStock: 3, lowThreshold: 10, amazonLink: 'https://amazon.com/socks2' },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.name, 'Socks (crew)');
  assert.equal(edited.data.amazonLink, 'https://amazon.com/socks2');

  const list = await call('GET', '/api/items', { token: tokens.volunteer });
  assert.equal(list.status, 200);
  assert.equal(list.data[0].isLowStock, true);
});

test('store links: Temu/Dollar General kept when the old app edits an item', async () => {
  const r = await call('PATCH', `/api/items/${ids.socks}`, {
    token: tokens.admin,
    body: {
      sources: [
        { store: 'temu', url: 'https://temu.com/socks', price: 9.99, unitsPerPack: 24 },
        { store: 'amazon', url: 'https://amazon.com/socks3' },
        { store: 'dollar_general', url: 'https://dollargeneral.com/socks' },
      ],
    },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.amazonLink, 'https://amazon.com/socks3');

  const old = await call('PATCH', `/api/items/${ids.socks}`, { token: tokens.admin, body: { amazonLink: 'https://amazon.com/socks4' } });
  assert.deepEqual(old.data.sources.map((s) => s.store).sort(), ['amazon', 'dollar_general', 'temu']);
  assert.equal(old.data.sources.find((s) => s.store === 'amazon').url, 'https://amazon.com/socks4');
});

test('old app tally, stock, events, budget, reports, survey still work', async () => {
  const ev = await call('POST', '/api/events', { token: tokens.volunteer, body: { location: 'Heritage Park' } });
  assert.equal(ev.status, 201);
  ids.event = ev.data._id;
  assert.equal((await call('POST', `/api/events/${ids.event}/tally`, { token: tokens.volunteer, body: { countIncrement: 5 } })).status, 201);
  assert.equal((await call('POST', `/api/events/${ids.event}/tally`, { token: tokens.volunteer, body: { countIncrement: 1 } })).status, 201);
  const detail = await call('GET', `/api/events/${ids.event}`, { token: tokens.volunteer });
  assert.equal(detail.data.totalServed, 6);

  const adj = await call('POST', `/api/items/${ids.socks}/adjust-stock`, { token: tokens.volunteer, body: { type: 'distributed', quantityDelta: -2 } });
  assert.equal(adj.status, 200);
  assert.equal(adj.data.item.currentStock, 1);

  assert.equal((await call('GET', '/api/budget/current', { token: tokens.volunteer })).status, 200);
  const now = new Date();
  const rep = await call('GET', `/api/reports/custom?start=${new Date(now.getFullYear(), 0, 1).toISOString()}&end=${new Date(now.getTime() + 86400000).toISOString()}&groupBy=month`, { token: tokens.admin });
  // FerretDB (the lightweight test database) lacks $abs, which reports use.
  if (!process.env.TEST_DB_IS_FERRET) assert.equal(rep.status, 200);

  const s = await call('POST', '/api/survey', { body: { answers: { repeat: 'first_time', applies: ['veteran'] }, language: 'en' } });
  assert.equal(s.status, 201);
  assert.equal((await call('GET', '/api/survey/summary', { token: tokens.admin })).data.total, 1);
});

test('roles are still enforced on the old routes', async () => {
  assert.equal((await call('GET', '/api/items')).status, 401);
  assert.equal((await call('GET', '/api/items', { token: tokens.neighbor })).status, 403);
  assert.equal((await call('POST', '/api/items', { token: tokens.volunteer, body: {} })).status, 403);
  assert.equal((await call('GET', '/api/survey/summary', { token: tokens.volunteer })).status, 403);
});

test('public summary: totals and needs, nothing private', async () => {
  // The estimate for before counting began is reported apart from real counts.
  await HistoricalEstimate.create({ peopleServed: 1000, throughDate: new Date('2026-07-17T00:00:00Z') });
  const r = await call('GET', '/api/public/summary');
  assert.equal(r.status, 200);
  assert.equal(r.data.peopleServed.counted, 6);
  assert.equal(r.data.peopleServed.estimated, 1000);
  assert.equal(r.data.peopleServed.allTime, 1006);
  assert.equal(r.data.peopleServed.thisYear, 6, 'this year = hand counts only');
  assert.ok(r.data.peopleServed.countedSince);
  assert.equal(r.data.outreachEvents, 1, 'only events with a hand count');
  assert.equal(r.data.itemsGiven.allTime, 2);
  assert.equal(r.data.needs[0].name, 'Socks (crew)');
  assert.equal(r.data.needs[0].status, 'low');
  assert.equal(r.data.mostNeeded[0].givenLast8Weeks, 2);
  const json = JSON.stringify(r.data);
  for (const secret of ['currentStock', 'unitCost', 'lowThreshold', 'price', 'pinHash', 'Ada', 'answers']) {
    assert.ok(!json.includes(secret), `public summary leaked ${secret}`);
  }
});

test('admin data: only admins, and lists every collection', async () => {
  assert.equal((await call('GET', '/api/admin/collections')).status, 401);
  assert.equal((await call('GET', '/api/admin/collections', { token: tokens.volunteer })).status, 403);
  assert.equal((await call('GET', '/api/admin/users', { token: tokens.neighbor })).status, 403);
  const r = await call('GET', '/api/admin/collections', { token: tokens.admin });
  assert.equal(r.status, 200);
  assert.ok(r.data.length >= 12);
  assert.equal((await call('GET', '/api/admin/nope', { token: tokens.admin })).status, 404);
});

test('admin data: people CRUD, PINs hashed, last-admin guard', async () => {
  const list = await call('GET', '/api/admin/users', { token: tokens.admin });
  assert.equal(list.data.total, 3);
  assert.ok(!JSON.stringify(list.data).includes('pinHash'));

  assert.equal((await call('POST', '/api/admin/users', { token: tokens.admin, body: { name: 'New', role: 'volunteer' } })).status, 400);
  assert.equal((await call('POST', '/api/admin/users', { token: tokens.admin, body: { name: 'New', role: 'volunteer', pin: '12' } })).status, 400);
  const made = await call('POST', '/api/admin/users', { token: tokens.admin, body: { name: 'Nia New', role: 'volunteer', pin: '4444', active: true } });
  assert.equal(made.status, 201);
  assert.equal((await call('POST', '/api/auth/login', { body: { userId: made.data._id, pin: '4444' } })).status, 200);

  const reset = await call('PATCH', `/api/admin/users/${made.data._id}`, { token: tokens.admin, body: { pin: '5555', name: 'Nia N.' } });
  assert.equal(reset.data.name, 'Nia N.');
  assert.equal((await call('POST', '/api/auth/login', { body: { userId: made.data._id, pin: '5555' } })).status, 200);

  const demote = await call('PATCH', `/api/admin/users/${ids.admin}`, { token: tokens.admin, body: { role: 'volunteer' } });
  assert.equal(demote.status, 400);
  assert.equal((await call('DELETE', `/api/admin/users/${ids.admin}`, { token: tokens.admin })).status, 400);

  assert.equal((await call('DELETE', `/api/admin/users/${made.data._id}`, { token: tokens.admin })).status, 200);
});

test('admin data: item edits log stock changes; events delete their counts', async () => {
  const r = await call('PATCH', `/api/admin/items/${ids.socks}`, { token: tokens.admin, body: { currentStock: 41 } });
  assert.equal(r.status, 200);
  const hist = await call('GET', `/api/admin/inventoryTransactions?item=${ids.socks}`, { token: tokens.admin });
  assert.ok(hist.data.rows.some((t) => t.quantityDelta === 40 && t.type === 'adjustment'));
  assert.equal(hist.data.rows[0].item.name, 'Socks (crew)');

  assert.equal((await call('PATCH', `/api/admin/items/${ids.socks}`, { token: tokens.admin, body: { sources: [{ store: 'temu', url: 'javascript:alert(1)' }] } })).status, 400);

  assert.equal((await call('DELETE', `/api/admin/events/${ids.event}`, { token: tokens.admin })).status, 200);
  const tallies = await call('GET', `/api/admin/tallies?distributionEvent=${ids.event}`, { token: tokens.admin });
  assert.equal(tallies.data.total, 0);
});

test('admin data: survey responses one by one, read-only; search; change log', async () => {
  const r = await call('GET', '/api/admin/surveyResponses', { token: tokens.admin });
  assert.equal(r.data.total, 1);
  assert.deepEqual(r.data.rows[0].answers.applies, ['veteran']);
  const id = r.data.rows[0]._id;
  assert.equal((await call('GET', `/api/admin/surveyResponses/${id}`, { token: tokens.admin })).status, 200);
  assert.equal((await call('PATCH', `/api/admin/surveyResponses/${id}`, { token: tokens.admin, body: {} })).status, 405);

  const found = await call('GET', '/api/admin/users?q=ned', { token: tokens.admin });
  assert.equal(found.data.total, 1);
  const regex = await call('GET', '/api/admin/users?q=.*', { token: tokens.admin });
  assert.equal(regex.data.total, 0);

  const log = await call('GET', '/api/admin/auditLog', { token: tokens.admin });
  assert.ok(log.data.total >= 4);
  assert.equal(log.data.rows[0].user.name, 'Ada Admin');
  assert.equal((await call('DELETE', `/api/admin/auditLog/${log.data.rows[0]._id}`, { token: tokens.admin })).status, 405);
});

test('push devices: anyone can turn notifications on; logins link the phone', async () => {
  const guest = await call('POST', '/api/notifications/devices', {
    body: { token: 'ExponentPushToken[guest]', platform: 'android', prefs: { outreach: true, pantry: false, needs: true }, hideContent: true },
  });
  assert.equal(guest.status, 200);
  assert.equal(guest.data.linkedToLogin, false);
  assert.equal(guest.data.prefs.pantry, false);
  assert.equal(guest.data.hideContent, true);
  assert.equal((await call('POST', '/api/notifications/devices', { body: { token: 'not-a-token' } })).status, 400);

  const vol = await call('POST', '/api/notifications/devices', { token: tokens.volunteer, body: { token: 'ExponentPushToken[vol]', prefs: { staff: true, chat: true } } });
  assert.equal(vol.data.linkedToLogin, true);
  await call('POST', '/api/notifications/devices', { token: tokens.admin, body: { token: 'ExponentPushToken[admin]' } });
  // A neighbor's phone is linked too, but never counts as staff.
  await call('POST', '/api/notifications/devices', { token: tokens.neighbor, body: { token: 'ExponentPushToken[neighbor]' } });
});

test('admins send notices; volunteers cannot; every send is logged', async () => {
  // The admin's own phone is left out of the count.
  const staff = await call('GET', '/api/notifications/audience?audience=staff', { token: tokens.admin });
  assert.deepEqual(staff.data, { count: 1 });
  const everyonePantry = await call('GET', '/api/notifications/audience?audience=everyone&kind=pantry', { token: tokens.admin });
  assert.equal(everyonePantry.data.count, 2); // volunteer + neighbor; the guest turned pantry off
  assert.equal((await call('GET', '/api/notifications/audience?audience=everyone&kind=chat', { token: tokens.admin })).status, 400);

  assert.equal((await call('POST', '/api/notifications/send', { token: tokens.volunteer, body: { title: 'Hi', body: 'x', audience: 'staff' } })).status, 403);
  assert.equal((await call('POST', '/api/notifications/send', { token: tokens.admin, body: { title: '', body: 'x', audience: 'staff' } })).status, 400);

  const sent = await call('POST', '/api/notifications/send', {
    token: tokens.admin,
    body: { title: 'Meet at 9:30', body: 'Bring gloves, it is cold.', audience: 'staff' },
  });
  assert.equal(sent.status, 201);
  assert.equal(sent.data.recipients, 1);

  const history = await call('GET', '/api/notifications/sent', { token: tokens.admin });
  assert.equal(history.data[0].sentBy.name, 'Ada Admin');
  assert.equal(history.data[0].kind, 'staff');
  const log = await call('GET', '/api/admin/auditLog?collectionKey=sentNotifications', { token: tokens.admin });
  assert.equal(log.data.total, 1);

  // Every switch off: the phone is forgotten.
  assert.equal((await call('DELETE', '/api/notifications/devices', { body: { token: 'ExponentPushToken[guest]' } })).status, 200);
  const after = await call('GET', '/api/notifications/audience?audience=everyone&kind=outreach', { token: tokens.admin });
  assert.equal(after.data.count, 2);
});

test('team chat: staff only; delete your own, admins delete any', async () => {
  assert.equal((await call('GET', '/api/team-chat', { token: tokens.neighbor })).status, 403);
  assert.equal((await call('POST', '/api/team-chat', { token: tokens.volunteer, body: { body: '   ' } })).status, 400);

  const a = await call('POST', '/api/team-chat', { token: tokens.volunteer, body: { body: 'Out of size L coats' } });
  assert.equal(a.status, 201);
  assert.equal(a.data.author.name, 'Val Volunteer');
  const b = await call('POST', '/api/team-chat', { token: tokens.admin, body: { body: 'Buying some today' } });

  const list = await call('GET', '/api/team-chat', { token: tokens.volunteer });
  assert.deepEqual(list.data.map((m) => m.body), ['Out of size L coats', 'Buying some today']);

  assert.equal((await call('DELETE', `/api/team-chat/${b.data._id}`, { token: tokens.volunteer })).status, 403);
  assert.equal((await call('DELETE', `/api/team-chat/${a.data._id}`, { token: tokens.admin })).status, 200);
  assert.equal((await call('GET', '/api/team-chat', { token: tokens.volunteer })).data.length, 1);
});

// A tiny valid JPEG header is enough - the server stores bytes, it doesn't decode them.
const PHOTO = { base64: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]).toString('base64'), contentType: 'image/jpeg' };

test('receipts: staff add with photo and restock; admins edit and delete', async () => {
  const items = await call('GET', '/api/items', { token: tokens.admin });
  const socks = items.data.find((i) => i._id === ids.socks);
  const before = socks.currentStock;

  assert.equal((await call('POST', '/api/receipts', { token: tokens.neighbor, body: {} })).status, 403);
  assert.equal((await call('POST', '/api/receipts', { token: tokens.volunteer, body: { store: 'Walmart', date: '2026-10-31', total: 'abc' } })).status, 400);
  assert.equal((await call('POST', '/api/receipts', { token: tokens.volunteer, body: { store: 'Walmart', date: '2099-01-01', total: 5 } })).status, 400);

  const created = await call('POST', '/api/receipts', {
    token: tokens.volunteer,
    body: { store: 'Walmart', date: '2026-10-31', total: 42.5, category: 'winter', photo: PHOTO, lines: [{ itemId: ids.socks, quantity: 12 }] },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.month, '2026-10');
  assert.equal(created.data.hasPhoto, true);
  assert.equal(created.data.uploadedBy.name, 'Val Volunteer');
  ids.receipt = created.data._id;

  const after = (await call('GET', '/api/items', { token: tokens.admin })).data.find((i) => i._id === ids.socks);
  assert.equal(after.currentStock, before + 12);

  const photo = await fetch(`${base}/api/receipts/${ids.receipt}/photo`, { headers: { Authorization: `Bearer ${tokens.volunteer}` } });
  assert.equal(photo.headers.get('content-type'), 'image/jpeg');
  assert.equal(Buffer.from(await photo.arrayBuffer()).toString('base64'), PHOTO.base64);

  // A manual receipt with no photo and no items (gas for the outreach van).
  const gas = await call('POST', '/api/receipts', { token: tokens.admin, body: { store: 'Casey\'s', date: '2026-10-30', total: 30, category: 'operations' } });
  assert.equal(gas.status, 201);
  assert.equal(gas.data.hasPhoto, false);

  // Volunteers can't edit; admins can, and lines stay as they were.
  assert.equal((await call('PATCH', `/api/receipts/${ids.receipt}`, { token: tokens.volunteer, body: { total: 1 } })).status, 403);
  const edited = await call('PATCH', `/api/receipts/${ids.receipt}`, { token: tokens.admin, body: { total: 40, date: '2026-11-01', removePhoto: true } });
  assert.equal(edited.data.total, 40);
  assert.equal(edited.data.month, '2026-11');
  assert.equal(edited.data.hasPhoto, false);
  assert.equal(edited.data.lines[0].quantity, 12);
  assert.equal((await call('GET', `/api/receipts/${ids.receipt}/photo`, { token: tokens.admin })).status, 404);

  const log = await call('GET', '/api/admin/auditLog?collectionKey=receipts', { token: tokens.admin });
  assert.equal(log.data.total, 3);

  assert.equal((await call('DELETE', `/api/receipts/${gas.data._id}`, { token: tokens.volunteer })).status, 403);
  assert.equal((await call('DELETE', `/api/receipts/${gas.data._id}`, { token: tokens.admin })).status, 200);
});

test('budget: any month, admins set the total, receipts count as spending', async () => {
  const nov = await call('GET', '/api/budget/month/2026-11', { token: tokens.volunteer });
  assert.equal(nov.status, 200);
  assert.equal(nov.data.receipts.length, 1);
  assert.ok(nov.data.amountSpent >= 40);
  assert.ok(nov.data.spentByCategory.winter >= 40);

  const old = await call('GET', '/api/budget/month/2020-01', { token: tokens.admin });
  assert.equal(old.data.isDefault, true);
  assert.equal(old.data.budget.totalBudget, 2800);

  assert.equal((await call('PATCH', '/api/budget/month/2026-11', { token: tokens.volunteer, body: { totalBudget: 3500 } })).status, 403);
  assert.equal((await call('PATCH', '/api/budget/month/2026-11', { token: tokens.admin, body: { totalBudget: -1 } })).status, 400);
  const set = await call('PATCH', '/api/budget/month/2026-11', { token: tokens.admin, body: { totalBudget: 3500 } });
  assert.equal(set.data.totalBudget, 3500);
  const again = await call('GET', '/api/budget/month/2026-11', { token: tokens.admin });
  assert.equal(again.data.isDefault, false);
  assert.equal(again.data.remaining, Math.round((3500 - again.data.amountSpent) * 100) / 100);

  const report = await call('GET', '/api/reports/custom?start=2026-11-01T00:00:00Z&end=2026-11-30T23:59:59Z', { token: tokens.admin });
  assert.ok(report.data.summary.totalSpent >= 40);
  assert.ok(report.data.spendByCategory.some((c) => c.category === 'winter'));
});

test('receipts: photo download is named for QuickBooks; month exports as CSV', async () => {
  const r = await call('POST', '/api/receipts', { token: tokens.admin, body: { store: 'Dollar General', date: '2026-11-02', total: 12.5, note: 'Soap, "travel" size', photo: PHOTO } });
  const dl = await fetch(`${base}/api/receipts/${r.data._id}/photo?download=1`, { headers: { Authorization: `Bearer ${tokens.admin}` } });
  assert.match(dl.headers.get('content-disposition'), /filename="2026-11-02 Dollar General 12\.50\.jpg"/);

  assert.equal((await call('GET', '/api/receipts/export.csv?month=2026-11', { token: tokens.volunteer })).status, 403);
  const csv = await fetch(`${base}/api/receipts/export.csv?month=2026-11`, { headers: { Authorization: `Bearer ${tokens.admin}` } });
  const text = await csv.text();
  const lines = text.trim().split('\r\n');
  assert.equal(lines[0], 'Date,Payee,Amount,Category,Memo,Receipt photo,Added by');
  assert.ok(lines.some((l) => l.startsWith('11/02/2026,Dollar General,12.50,Other supplies,"Soap, ""travel"" size",2026-11-02 Dollar General 12.50.jpg,Ada Admin')));
});

test('people: admins add, edit, reset PINs, and remove access; a new PIN logs out old logins', async () => {
  assert.equal((await call('POST', '/api/admin/users', { token: tokens.volunteer, body: { name: 'X', role: 'admin', pin: '1234' } })).status, 403);

  const added = await call('POST', '/api/admin/users', { token: tokens.admin, body: { name: 'Bo Board', role: 'admin', pin: '4321', active: true } });
  assert.equal(added.status, 201);
  assert.equal(added.data.pinHash, undefined);
  const id = added.data._id;
  const login = await call('POST', '/api/auth/login', { body: { userId: id, pin: '4321' } });
  const oldToken = login.data.token;
  assert.equal((await call('GET', '/api/auth/me', { token: oldToken })).status, 200);

  // New PIN: the old login stops working everywhere; the new PIN works.
  assert.equal((await call('PATCH', `/api/admin/users/${id}`, { token: tokens.admin, body: { pin: '5555' } })).status, 200);
  assert.equal((await call('GET', '/api/auth/me', { token: oldToken })).status, 401);
  const relogin = await call('POST', '/api/auth/login', { body: { userId: id, pin: '5555' } });
  assert.equal((await call('GET', '/api/auth/me', { token: relogin.data.token })).status, 200);

  // Making them a volunteer takes admin access away on the next request.
  await call('PATCH', `/api/admin/users/${id}`, { token: tokens.admin, body: { role: 'volunteer' } });
  assert.equal((await call('GET', '/api/admin/users', { token: relogin.data.token })).status, 403);

  // Turning off "Can log in" ends their access and hides them from the login list.
  await call('PATCH', `/api/admin/users/${id}`, { token: tokens.admin, body: { active: false } });
  assert.equal((await call('GET', '/api/auth/me', { token: relogin.data.token })).status, 401);
  assert.ok(!(await call('GET', '/api/auth/names')).data.some((u) => u._id === id));

  assert.equal((await call('DELETE', `/api/admin/users/${id}`, { token: tokens.admin })).status, 200);
  assert.equal((await call('PATCH', `/api/admin/users/${ids.admin}`, { token: tokens.admin, body: { active: false } })).status, 400);
});
