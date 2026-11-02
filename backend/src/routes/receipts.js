const express = require('express');
const mongoose = require('mongoose');
const Receipt = require('../models/Receipt');
const ReceiptPhoto = require('../models/ReceiptPhoto');
const Item = require('../models/Item');
const InventoryTransaction = require('../models/InventoryTransaction');
const AuditLog = require('../models/AuditLog');
const { requireAuth, requireAdmin, requireStaff } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Receipts: any volunteer or admin can add one (whoever did the shopping);
// only admins can edit or delete them.
router.use(requireAuth, requireStaff);

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

class BadRequest extends Error {}

function audit(req, action, receipt, fields = []) {
  return AuditLog.create({ user: req.user._id, action, collectionKey: 'receipts', docId: String(receipt._id), fields });
}

// "2026-11-02" -> noon UTC that day, so no time zone moves it to another day.
function readDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) throw new BadRequest('Enter the date on the receipt.');
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new BadRequest('Enter the date on the receipt.');
  if (date.getTime() > Date.now() + 2 * 24 * 60 * 60 * 1000) throw new BadRequest("The receipt's date is in the future.");
  return { date, month: value.slice(0, 7) };
}

function readMoneyFields(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.store !== undefined) {
    const store = typeof body.store === 'string' ? body.store.trim() : '';
    if (!store) throw new BadRequest('Enter the store.');
    out.store = store.slice(0, 100);
  }
  if (!partial || body.total !== undefined) {
    const total = Number(body.total);
    if (body.total === '' || body.total == null || !Number.isFinite(total) || total < 0) throw new BadRequest('Enter the total as a number.');
    out.total = Math.round(total * 100) / 100;
  }
  if (!partial || body.date !== undefined) Object.assign(out, readDate(body.date));
  if (body.category !== undefined) {
    if (!Receipt.CATEGORIES.includes(body.category)) throw new BadRequest('Unknown category.');
    out.category = body.category;
  }
  if (body.note !== undefined) out.note = String(body.note || '').trim().slice(0, 500);
  return out;
}

function readPhoto(photo) {
  if (!photo) return null;
  const contentType = ['image/jpeg', 'image/png', 'image/webp'].includes(photo.contentType) ? photo.contentType : null;
  if (!contentType || typeof photo.base64 !== 'string') throw new BadRequest('The photo must be a JPEG, PNG, or WebP image.');
  const data = Buffer.from(photo.base64, 'base64');
  if (!data.length) throw new BadRequest('The photo was empty.');
  if (data.length > MAX_PHOTO_BYTES) throw new BadRequest('The photo is too large (3 MB at most).');
  return { contentType, data, size: data.length };
}

function sendError(res, err) {
  if (err instanceof BadRequest) return res.status(400).json({ error: err.message });
  throw err;
}

// GET /api/receipts?month=YYYY-MM - that month's receipts (no photos).
router.get('/', asyncHandler(async (req, res) => {
  const filter = /^\d{4}-\d{2}$/.test(req.query.month || '') ? { month: req.query.month } : {};
  const receipts = await Receipt.find(filter).sort({ date: -1, createdAt: -1 }).limit(200).populate('uploadedBy', 'name');
  res.json(receipts);
}));

// GET /api/receipts/storage - how much space receipt photos use, so admins
// can see it coming long before the database fills up.
router.get('/storage', asyncHandler(async (req, res) => {
  const [stats] = await ReceiptPhoto.aggregate([{ $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: '$size' } } }]);
  res.json({ photos: stats?.count || 0, bytes: stats?.bytes || 0 });
}));

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// "2026-10-31 Walmart 42.50.jpg" - what a downloaded photo is called, and
// what the CSV export points to, so they're easy to match up in QuickBooks.
function photoFilename(receipt, contentType = 'image/jpeg') {
  const day = receipt.date.toISOString().slice(0, 10);
  const store = receipt.store.replace(/[^\w .&'-]+/g, '').trim().slice(0, 40) || 'Receipt';
  return `${day} ${store} ${receipt.total.toFixed(2)}.${EXTENSIONS[contentType] || 'jpg'}`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const CATEGORY_LABELS = { hygiene: 'Hygiene supplies', winter: 'Winter gear', other: 'Other supplies', operations: 'Operations' };

// GET /api/receipts/export.csv?month=YYYY-MM (admin) - a month's receipts as
// a spreadsheet for the bookkeeper: one row per receipt, with the photo's
// file name (download photos with ?download=1 on each photo).
router.get('/export.csv', requireAdmin, asyncHandler(async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : null;
  if (!month) return res.status(400).json({ error: 'Month must look like 2026-10.' });
  const receipts = await Receipt.find({ month }).sort({ date: 1, createdAt: 1 }).populate('uploadedBy', 'name');
  const rows = [['Date', 'Payee', 'Amount', 'Category', 'Memo', 'Receipt photo', 'Added by']];
  for (const r of receipts) {
    const [y, m, d] = r.date.toISOString().slice(0, 10).split('-');
    rows.push([
      `${m}/${d}/${y}`,
      r.store,
      r.total.toFixed(2),
      CATEGORY_LABELS[r.category] || r.category,
      r.note,
      r.hasPhoto ? photoFilename(r) : '',
      r.uploadedBy?.name || '',
    ]);
  }
  res.set('Content-Disposition', `attachment; filename="Feed Sioux Falls receipts ${month}.csv"`);
  res.type('text/csv').send(`${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`);
}));

// GET /api/receipts/:id/photo - the image itself. ?download=1 saves it as a
// file named "2026-10-31 Walmart 42.50.jpg" (ready for QuickBooks).
router.get('/:id/photo', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'No photo.' });
  const [photo, receipt] = await Promise.all([ReceiptPhoto.findOne({ receipt: req.params.id }), Receipt.findById(req.params.id)]);
  if (!photo || !receipt) return res.status(404).json({ error: 'No photo.' });
  res.set('Cache-Control', 'private, max-age=86400');
  if (req.query.download) res.set('Content-Disposition', `attachment; filename="${photoFilename(receipt, photo.contentType)}"`);
  res.type(photo.contentType).send(photo.data);
}));

// POST /api/receipts
// Body: { store, date: "YYYY-MM-DD", total, category?, note?,
//         photo?: { base64, contentType }, lines?: [{ itemId, quantity }] }
// Each line adds that many to the item's stock (a 'restock' in the history).
router.post('/', asyncHandler(async (req, res) => {
  let fields;
  let photo;
  const lines = [];
  try {
    fields = readMoneyFields(req.body);
    photo = readPhoto(req.body.photo);
    for (const line of Array.isArray(req.body.lines) ? req.body.lines.slice(0, 50) : []) {
      const quantity = Number(line?.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) throw new BadRequest('Each item needs a quantity of 1 or more.');
      if (!mongoose.isValidObjectId(line.itemId)) throw new BadRequest('Unknown item.');
      const item = await Item.findById(line.itemId);
      if (!item) throw new BadRequest('One of the items no longer exists.');
      lines.push({ item, quantity });
    }
  } catch (err) {
    return sendError(res, err);
  }

  const receipt = await Receipt.create({
    ...fields,
    hasPhoto: !!photo,
    lines: lines.map(({ item, quantity }) => ({ item: item._id, name: item.name, quantity })),
    uploadedBy: req.user._id,
  });
  if (photo) await ReceiptPhoto.create({ receipt: receipt._id, ...photo });

  for (const { item, quantity } of lines) {
    await Item.updateOne({ _id: item._id }, { $inc: { currentStock: quantity } });
    await InventoryTransaction.create({ item: item._id, type: 'restock', quantityDelta: quantity, createdBy: req.user._id });
  }

  await audit(req, 'create', receipt, Object.keys(fields).concat(photo ? ['photo'] : [], lines.length ? ['lines'] : []));
  await receipt.populate('uploadedBy', 'name');
  res.status(201).json(receipt);
}));

// PATCH /api/receipts/:id (admin) - fix the store, date, total, category, or
// note; replace the photo ({ photo }) or remove it ({ removePhoto: true }).
// Restocked items can't be changed here (see the model).
router.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Receipt not found.' });
  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) return res.status(404).json({ error: 'Receipt not found.' });

  let fields;
  let photo;
  try {
    fields = readMoneyFields(req.body, { partial: true });
    photo = readPhoto(req.body.photo);
  } catch (err) {
    return sendError(res, err);
  }

  receipt.set(fields);
  const changed = Object.keys(fields);
  if (photo) {
    await ReceiptPhoto.findOneAndUpdate({ receipt: receipt._id }, { ...photo }, { upsert: true, runValidators: true });
    receipt.hasPhoto = true;
    changed.push('photo');
  } else if (req.body.removePhoto === true) {
    await ReceiptPhoto.deleteOne({ receipt: receipt._id });
    receipt.hasPhoto = false;
    changed.push('photo');
  }
  await receipt.save();
  await audit(req, 'update', receipt, changed);
  await receipt.populate('uploadedBy', 'name');
  res.json(receipt);
}));

// DELETE /api/receipts/:id (admin) - removes the receipt and its photo from
// the budget. Stock it added stays (fix with +/- if that was wrong too).
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Receipt not found.' });
  const receipt = await Receipt.findByIdAndDelete(req.params.id);
  if (!receipt) return res.status(404).json({ error: 'Receipt not found.' });
  await ReceiptPhoto.deleteOne({ receipt: receipt._id });
  await audit(req, 'delete', receipt);
  res.json({ success: true });
}));

module.exports = router;
