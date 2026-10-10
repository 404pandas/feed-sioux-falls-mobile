const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');
const InventoryTransaction = require('../models/InventoryTransaction');
const DistributionEvent = require('../models/DistributionEvent');
const PersonServedTally = require('../models/PersonServedTally');
const PurchaseLog = require('../models/PurchaseLog');
const MonthlyBudget = require('../models/MonthlyBudget');
const Donation = require('../models/Donation');
const ContactMessage = require('../models/ContactMessage');
const SurveyResponse = require('../models/SurveyResponse');
const SurveyContactRequest = require('../models/SurveyContactRequest');
const AuditLog = require('../models/AuditLog');
const HistoricalEstimate = require('../models/HistoricalEstimate');
const { SURVEY_LANGUAGES } = require('../utils/surveyQuestions');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Admin "Data" screens: view, add, edit, and delete records in every
// collection. Admins only - every route below sits behind requireAuth +
// requireAdmin, and only the fields listed for each collection can be read
// back or written (so e.g. a PIN hash can never be sent or overwritten).
router.use(requireAuth, requireAdmin);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// --- Field types the website knows how to show and edit ---
// string, text (multi-line), number, boolean, date, enum (options), ref
// (another collection), json (read-only structured data), pin (write-only).
const f = (name, label, type, extra = {}) => ({ name, label, type, ...extra });

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function budgetForDate(date) {
  const month = monthKey(date || new Date());
  return (await MonthlyBudget.findOne({ month })) || MonthlyBudget.create({ month, totalBudget: 2800 });
}

async function activeAdminCount(excludeId) {
  return User.countDocuments({ role: 'admin', active: true, _id: { $ne: excludeId } });
}

// Each collection: the model, which fields admins see and can change, what
// the list searches, and any special rules. `title` picks the field shown as
// a record's name in lists and in links from other collections.
const COLLECTIONS = {
  users: {
    model: User,
    label: 'People & Logins',
    description: 'Everyone who can log in. Setting a PIN replaces their old one. Deactivate instead of deleting to keep their name on past records.',
    title: 'name',
    search: ['name'],
    sort: { role: 1, name: 1 },
    fields: [
      f('name', 'Name', 'string', { required: true }),
      f('role', 'Role', 'enum', { required: true, options: ['admin', 'volunteer', 'neighbor'] }),
      f('active', 'Can log in', 'boolean'),
      f('pin', 'PIN (4-6 digits)', 'pin', { requiredOnCreate: true }),
      f('createdAt', 'Added', 'date', { readOnly: true }),
    ],
    async beforeWrite(data, { existing, req }) {
      if (data.pin !== undefined && data.pin !== '') {
        if (!/^\d{4,6}$/.test(String(data.pin))) throw new HttpError(400, 'PIN must be 4 to 6 digits.');
      }
      if (!existing && !data.pin) throw new HttpError(400, 'Set a PIN for the new person.');
      if (existing) {
        const losingAdmin =
          existing.role === 'admin' && existing.active &&
          ((data.role && data.role !== 'admin') || data.active === false);
        if (losingAdmin && (await activeAdminCount(existing._id)) === 0) {
          throw new HttpError(400, 'There has to be at least one active admin. Make someone else an admin first.');
        }
        if (String(existing._id) === String(req.user._id) && data.active === false) {
          throw new HttpError(400, "You can't deactivate yourself.");
        }
      }
      return data;
    },
    async applyWrite(doc, data) {
      const { pin, ...rest } = data;
      doc.set(rest);
      if (pin) await doc.setPin(String(pin));
    },
    async beforeDelete(doc, { req }) {
      if (String(doc._id) === String(req.user._id)) throw new HttpError(400, "You can't delete yourself.");
      if (doc.role === 'admin' && doc.active && (await activeAdminCount(doc._id)) === 0) {
        throw new HttpError(400, "You can't delete the last admin.");
      }
    },
  },

  items: {
    model: Item,
    label: 'Inventory Items',
    description: 'Every item the pantry tracks. Stock changes made here are recorded as an adjustment in the inventory history.',
    title: 'name',
    search: ['name', 'unitType'],
    sort: { category: 1, name: 1 },
    fields: [
      f('name', 'Name', 'string', { required: true }),
      f('category', 'Category', 'enum', { required: true, options: ['hygiene', 'winter', 'other'] }),
      f('unitType', 'Unit', 'string', { required: true }),
      f('unitCost', 'Cost per unit ($)', 'number', { required: true }),
      f('currentStock', 'In stock', 'number'),
      f('lowThreshold', 'Low at', 'number', { required: true }),
      f('sources', 'Where to buy', 'sources'),
      f('hideFromPublic', 'Hide from public needs list', 'boolean'),
      f('updatedAt', 'Last changed', 'date', { readOnly: true }),
    ],
    async applyWrite(doc, data, { req }) {
      const before = doc.isNew ? 0 : doc.currentStock;
      doc.set(Item.syncAmazonLink(data, doc));
      const delta = (doc.currentStock || 0) - before;
      if (delta !== 0) {
        doc.$locals.stockDelta = delta;
        doc.$locals.userId = req.user._id;
      }
    },
    async afterWrite(doc) {
      if (doc.$locals.stockDelta) {
        await InventoryTransaction.create({
          item: doc._id,
          type: 'adjustment',
          quantityDelta: doc.$locals.stockDelta,
          createdBy: doc.$locals.userId,
        });
      }
    },
  },

  inventoryTransactions: {
    model: InventoryTransaction,
    label: 'Inventory History',
    description: 'Every stock change (restocks, items handed out, corrections). Editing or deleting a row here fixes the record only - it does not change current stock.',
    title: 'type',
    search: [],
    sort: { date: -1 },
    fields: [
      f('date', 'Date', 'date', { required: true }),
      f('item', 'Item', 'ref', { ref: 'items', required: true }),
      f('type', 'Type', 'enum', { required: true, options: ['restock', 'distributed', 'adjustment'] }),
      f('quantityDelta', 'Change (+/-)', 'number', { required: true }),
      f('cost', 'Cost ($)', 'number'),
      f('createdBy', 'By', 'ref', { ref: 'users', readOnly: true }),
    ],
    filters: ['item', 'type'],
  },

  events: {
    model: DistributionEvent,
    label: 'Outreach Events',
    description: 'Each outreach day or distribution. Deleting an event also deletes its people-served counts.',
    title: 'date',
    search: ['location', 'details'],
    sort: { date: -1 },
    fields: [
      f('date', 'Date & time', 'date', { required: true }),
      f('location', 'Location', 'string'),
      f('details', 'Notes', 'text'),
      f('createdBy', 'Created by', 'ref', { ref: 'users', readOnly: true }),
    ],
    async beforeDelete(doc) {
      await PersonServedTally.deleteMany({ distributionEvent: doc._id });
    },
  },

  tallies: {
    model: PersonServedTally,
    label: 'People-Served Counts',
    description: 'Each tap of the people-served counter (or a correction). An event\'s total is the sum of its rows.',
    title: 'countIncrement',
    search: [],
    sort: { timestamp: -1 },
    fields: [
      f('timestamp', 'Time', 'date', { required: true }),
      f('distributionEvent', 'Event', 'ref', { ref: 'events', required: true }),
      f('countIncrement', 'People (+/-)', 'number', { required: true }),
      f('source', 'How counted', 'enum', { options: ['tap', 'import'] }),
      f('createdBy', 'By', 'ref', { ref: 'users', readOnly: true }),
    ],
    filters: ['distributionEvent', 'source'],
  },

  estimates: {
    model: HistoricalEstimate,
    label: 'Estimate Before Counting',
    description: 'The estimated number of people served before volunteers started hand-counting. Shown on the website and app as an estimate, separate from real counts, and never included in date-range reports.',
    title: 'peopleServed',
    search: [],
    sort: { throughDate: -1 },
    fields: [
      f('peopleServed', 'People served (estimate)', 'number', { required: true }),
      f('throughDate', 'Estimate covers through', 'date', { required: true, dateOnly: true }),
      f('note', 'Note', 'text'),
      f('updatedAt', 'Last changed', 'date', { readOnly: true }),
    ],
  },

  purchases: {
    model: PurchaseLog,
    label: 'Purchases',
    description: 'Supplies bought, counted against that month\'s budget. Adding or editing a purchase here does not change stock - restock from Inventory for that.',
    title: 'date',
    search: [],
    sort: { date: -1 },
    fields: [
      f('date', 'Date', 'date', { required: true }),
      f('item', 'Item', 'ref', { ref: 'items', required: true }),
      f('quantity', 'Quantity', 'number', { required: true }),
      f('cost', 'Total cost ($)', 'number', { required: true }),
      f('amazonLink', 'Link used', 'string'),
      f('markedBy', 'Logged by', 'ref', { ref: 'users', readOnly: true }),
      f('monthlyBudget', 'Budget month', 'ref', { ref: 'budgets', readOnly: true }),
    ],
    filters: ['item', 'monthlyBudget'],
    async applyWrite(doc, data, { req }) {
      doc.set(data);
      if (doc.isNew) doc.markedBy = req.user._id;
      // Keep the purchase attached to the budget for the month it happened.
      if (doc.isNew || data.date) doc.monthlyBudget = (await budgetForDate(doc.date))._id;
    },
  },

  budgets: {
    model: MonthlyBudget,
    label: 'Monthly Budgets',
    description: 'The supply budget for each month (YYYY-MM).',
    title: 'month',
    search: ['month'],
    sort: { month: -1 },
    fields: [
      f('month', 'Month (YYYY-MM)', 'string', { required: true, pattern: '^\\d{4}-\\d{2}$' }),
      f('totalBudget', 'Budget ($)', 'number', { required: true }),
    ],
    async beforeDelete(doc) {
      const used = await PurchaseLog.countDocuments({ monthlyBudget: doc._id });
      if (used) throw new HttpError(400, `${used} purchase(s) are logged against this month. Move or delete them first.`);
    },
  },

  donations: {
    model: Donation,
    label: 'Donations (card)',
    description: 'Card donations made in the app or website through Stripe. Amounts and status come from Stripe and can\'t be edited here.',
    title: 'amount',
    search: ['donorName', 'donorEmail'],
    sort: { date: -1 },
    canCreate: false,
    fields: [
      f('date', 'Date', 'date', { readOnly: true }),
      f('amount', 'Amount ($)', 'number', { readOnly: true }),
      f('status', 'Status', 'enum', { readOnly: true, options: ['pending', 'succeeded', 'failed'] }),
      f('donorName', 'Donor name', 'string'),
      f('donorEmail', 'Donor email', 'string'),
      f('stripePaymentIntentId', 'Stripe ID', 'string', { readOnly: true }),
    ],
  },

  contactMessages: {
    model: ContactMessage,
    label: 'Messages',
    description: 'Messages sent through the Contact Us form.',
    title: 'message',
    search: ['name', 'email', 'phone', 'message'],
    sort: { date: -1 },
    fields: [
      f('date', 'Received', 'date', { readOnly: true }),
      f('category', 'Type', 'enum', { options: ['contact', 'assistance', 'donate', 'partner', 'suggestion'] }),
      f('name', 'Name', 'string'),
      f('phone', 'Phone', 'string'),
      f('email', 'Email', 'string'),
      f('message', 'Message', 'text', { required: true }),
      f('resolved', 'Handled', 'boolean'),
    ],
    filters: ['category', 'resolved'],
  },

  surveyResponses: {
    model: SurveyResponse,
    label: 'Survey Responses',
    description: 'Each anonymous community survey, one at a time. These are never shared outside Feed Sioux Falls - City Council only gets totals.',
    title: 'submittedOn',
    search: [],
    sort: { submittedOn: -1 },
    canCreate: false,
    canUpdate: false,
    fields: [
      f('submittedOn', 'Day sent', 'date', { readOnly: true, dateOnly: true }),
      f('language', 'Language', 'enum', { readOnly: true, options: SURVEY_LANGUAGES }),
      f('source', 'How filled out', 'enum', { readOnly: true, options: ['self', 'volunteer', 'paper'] }),
      f('answers', 'Answers', 'json', { readOnly: true }),
    ],
    filters: ['source', 'language'],
  },

  surveyContactRequests: {
    model: SurveyContactRequest,
    label: 'Survey Contact Requests',
    description: 'People who asked to be contacted on the survey. Kept apart from survey answers on purpose.',
    title: 'name',
    search: ['name', 'phone', 'email'],
    sort: { createdAt: -1 },
    canCreate: false,
    fields: [
      f('createdAt', 'Received', 'date', { readOnly: true }),
      f('name', 'Name', 'string'),
      f('phone', 'Phone', 'string'),
      f('email', 'Email', 'string'),
      f('bestTime', 'Best time', 'string'),
      f('safeToLeaveMessage', 'Safe to leave a message', 'boolean'),
      f('language', 'Language', 'enum', { options: SURVEY_LANGUAGES }),
      f('resolved', 'Contacted', 'boolean'),
    ],
    filters: ['resolved'],
  },

  auditLog: {
    model: AuditLog,
    label: 'Change Log',
    description: 'Who added, edited, or deleted records on these Data screens. Read-only.',
    title: 'action',
    search: ['collectionKey'],
    sort: { at: -1 },
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    fields: [
      f('at', 'When', 'date', { readOnly: true }),
      f('user', 'Who', 'ref', { ref: 'users', readOnly: true }),
      f('action', 'Action', 'enum', { readOnly: true, options: ['create', 'update', 'delete'] }),
      f('collectionKey', 'Collection', 'string', { readOnly: true }),
      f('docId', 'Record', 'string', { readOnly: true }),
      f('fields', 'Fields changed', 'json', { readOnly: true }),
    ],
    filters: ['collectionKey', 'action'],
  },
};

function getCollection(key) {
  const c = Object.prototype.hasOwnProperty.call(COLLECTIONS, key) ? COLLECTIONS[key] : null;
  if (!c) throw new HttpError(404, 'Unknown collection.');
  return c;
}

function permissions(c) {
  return { create: c.canCreate !== false, update: c.canUpdate !== false, delete: c.canDelete !== false };
}

function describe(key, c) {
  return {
    key,
    label: c.label,
    description: c.description,
    titleField: c.title,
    searchable: c.search.length > 0,
    filters: c.filters || [],
    permissions: permissions(c),
    fields: c.fields.map(({ name, label, type, options, ref, required, requiredOnCreate, readOnly, dateOnly, pattern }) => ({
      name, label, type, options, ref, required, requiredOnCreate, readOnly, dateOnly, pattern,
    })),
  };
}

function validId(c, id) {
  // Survey responses use random UUIDs; everything else uses ObjectIds.
  return c.model === SurveyResponse ? typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) : mongoose.isValidObjectId(id);
}

// Readable fields only (pin is write-only; never send pinHash).
function serialize(c, doc) {
  const obj = doc.toJSON ? doc.toJSON({ virtuals: false }) : doc;
  const out = { _id: obj._id };
  for (const field of c.fields) {
    if (field.type === 'pin') continue;
    out[field.name] = obj[field.name];
  }
  return out;
}

function populateFor(c) {
  return c.fields
    .filter((field) => field.type === 'ref')
    .map((field) => {
      const target = COLLECTIONS[field.ref];
      const select = target.title === 'date' ? 'date location' : target.title;
      return { path: field.name, select };
    });
}

// Copies only writable fields from the request, converting types and
// dropping anything not on the list.
function pickWritable(c, body, isCreate) {
  const data = {};
  for (const field of c.fields) {
    if (field.readOnly || field.type === 'json') continue;
    if (!Object.prototype.hasOwnProperty.call(body, field.name)) continue;
    let value = body[field.name];
    if (field.type === 'number') {
      value = value === '' || value === null ? null : Number(value);
      if (value !== null && !Number.isFinite(value)) throw new HttpError(400, `${field.label} must be a number.`);
    } else if (field.type === 'boolean') {
      value = value === null ? null : value === true || value === 'true';
    } else if (field.type === 'date') {
      value = value ? new Date(value) : null;
      if (value && Number.isNaN(value.getTime())) throw new HttpError(400, `${field.label} isn't a valid date.`);
    } else if (field.type === 'enum') {
      if (value !== null && value !== '' && !field.options.includes(value)) throw new HttpError(400, `${field.label} has an invalid choice.`);
      if (value === '') value = null;
    } else if (field.type === 'ref') {
      if (value && !mongoose.isValidObjectId(value)) throw new HttpError(400, `${field.label} is invalid.`);
    } else if (field.type === 'sources') {
      if (!Array.isArray(value)) throw new HttpError(400, `${field.label} must be a list.`);
      value = value
        .filter((s) => s && typeof s.url === 'string' && s.url.trim())
        .map((s) => ({
          store: Item.STORES.includes(s.store) ? s.store : 'other',
          url: s.url.trim(),
          price: s.price === '' || s.price == null ? null : Number(s.price),
          unitsPerPack: s.unitsPerPack === '' || s.unitsPerPack == null ? null : Number(s.unitsPerPack),
          note: typeof s.note === 'string' ? s.note.trim() : '',
        }));
      for (const s of value) {
        if (!/^https?:\/\//i.test(s.url)) throw new HttpError(400, 'Store links need to start with http:// or https://');
      }
    } else if (typeof value === 'string') {
      value = value.trim();
      if (field.pattern && value && !new RegExp(field.pattern).test(value)) throw new HttpError(400, `${field.label} isn't in the right format.`);
    }
    data[field.name] = value;
  }
  if (isCreate) {
    for (const field of c.fields) {
      const needed = field.required || field.requiredOnCreate;
      if (needed && !field.readOnly && (data[field.name] === undefined || data[field.name] === null || data[field.name] === '')) {
        throw new HttpError(400, `${field.label} is required.`);
      }
    }
  }
  return data;
}

async function audit(req, action, key, docId, fields = []) {
  try {
    await AuditLog.create({ user: req.user._id, action, collectionKey: key, docId: String(docId), fields });
  } catch {
    // Never fail the change itself because the log couldn't be written.
  }
}

function sendError(res, err) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.name === 'ValidationError') {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ error: first?.message || 'Some fields are invalid.' });
  }
  if (err?.code === 11000) return res.status(400).json({ error: 'A record with that value already exists.' });
  if (err?.name === 'CastError') return res.status(400).json({ error: 'One of the values is the wrong type.' });
  throw err;
}

const handle = (fn) => asyncHandler(async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/admin/collections - what exists, how many of each, and the
// field layout the website uses to build its tables and forms.
router.get('/collections', handle(async (req, res) => {
  const out = await Promise.all(
    Object.entries(COLLECTIONS).map(async ([key, c]) => ({ ...describe(key, c), count: await c.model.estimatedDocumentCount() }))
  );
  res.json(out);
}));

// GET /api/admin/:key?q=&page=1&limit=25&sort=field|-field&<filterField>=value
router.get('/:key', handle(async (req, res) => {
  const c = getCollection(req.params.key);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 25));

  const filter = {};
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  if (q && c.search.length) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = c.search.map((name) => ({ [name]: rx }));
  }
  for (const name of c.filters || []) {
    const value = req.query[name];
    if (typeof value !== 'string' || value === '') continue;
    const field = c.fields.find((x) => x.name === name);
    if (field?.type === 'boolean') filter[name] = value === 'true';
    else if (field?.type === 'ref') {
      if (mongoose.isValidObjectId(value)) filter[name] = value;
    } else filter[name] = value;
  }

  let sort = c.sort;
  if (typeof req.query.sort === 'string' && req.query.sort) {
    const desc = req.query.sort.startsWith('-');
    const name = desc ? req.query.sort.slice(1) : req.query.sort;
    if (c.fields.some((x) => x.name === name && x.type !== 'pin' && x.type !== 'json' && x.type !== 'sources')) {
      sort = { [name]: desc ? -1 : 1 };
    }
  }

  const [rows, total] = await Promise.all([
    c.model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate(populateFor(c)),
    c.model.countDocuments(filter),
  ]);
  res.json({ rows: rows.map((doc) => serialize(c, doc)), total, page, limit });
}));

// GET /api/admin/:key/:id
router.get('/:key/:id', handle(async (req, res) => {
  const c = getCollection(req.params.key);
  if (!validId(c, req.params.id)) throw new HttpError(404, 'Record not found.');
  const doc = await c.model.findById(req.params.id).populate(populateFor(c));
  if (!doc) throw new HttpError(404, 'Record not found.');
  res.json(serialize(c, doc));
}));

// POST /api/admin/:key
router.post('/:key', handle(async (req, res) => {
  const c = getCollection(req.params.key);
  if (!permissions(c).create) throw new HttpError(405, 'Records here can\'t be added by hand.');
  let data = pickWritable(c, req.body || {}, true);
  if (c.beforeWrite) data = await c.beforeWrite(data, { existing: null, req });

  const doc = new c.model();
  // Fill "created by" style fields with the admin making the change.
  for (const name of ['createdBy']) {
    if (c.model.schema.path(name)) doc[name] = req.user._id;
  }
  if (c.applyWrite) await c.applyWrite(doc, data, { req });
  else doc.set(data);
  await doc.save();
  if (c.afterWrite) await c.afterWrite(doc, { req });
  await audit(req, 'create', req.params.key, doc._id, Object.keys(data));

  const saved = await c.model.findById(doc._id).populate(populateFor(c));
  res.status(201).json(serialize(c, saved));
}));

// PATCH /api/admin/:key/:id
router.patch('/:key/:id', handle(async (req, res) => {
  const c = getCollection(req.params.key);
  if (!permissions(c).update) throw new HttpError(405, 'Records here can\'t be edited.');
  if (!validId(c, req.params.id)) throw new HttpError(404, 'Record not found.');
  const doc = await c.model.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'Record not found.');

  let data = pickWritable(c, req.body || {}, false);
  if (data.pin === '' || data.pin === null) delete data.pin; // blank PIN = keep the old one
  if (c.beforeWrite) data = await c.beforeWrite(data, { existing: doc, req });
  if (c.applyWrite) await c.applyWrite(doc, data, { req });
  else doc.set(data);
  await doc.save();
  if (c.afterWrite) await c.afterWrite(doc, { req });
  await audit(req, 'update', req.params.key, doc._id, Object.keys(data));

  const saved = await c.model.findById(doc._id).populate(populateFor(c));
  res.json(serialize(c, saved));
}));

// DELETE /api/admin/:key/:id
router.delete('/:key/:id', handle(async (req, res) => {
  const c = getCollection(req.params.key);
  if (!permissions(c).delete) throw new HttpError(405, 'Records here can\'t be deleted.');
  if (!validId(c, req.params.id)) throw new HttpError(404, 'Record not found.');
  const doc = await c.model.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'Record not found.');
  if (c.beforeDelete) await c.beforeDelete(doc, { req });
  await doc.deleteOne();
  await audit(req, 'delete', req.params.key, doc._id);
  res.json({ success: true });
}));

module.exports = router;
module.exports.COLLECTIONS = COLLECTIONS;
