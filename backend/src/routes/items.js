const express = require('express');
const Item = require('../models/Item');
const InventoryTransaction = require('../models/InventoryTransaction');
const { requireAuth, requireAdmin, requireStaff } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// All inventory routes require login as staff (volunteer or admin) -
// neighbors are logged in but have no reason to see or touch inventory.
router.use(requireAuth, requireStaff);

// GET /api/items - list everything, optionally ?lowStock=true
router.get('/', asyncHandler(async (req, res) => {
  const items = await Item.find().sort({ category: 1, name: 1 });
  const filtered = req.query.lowStock === 'true'
    ? items.filter((i) => i.currentStock <= i.lowThreshold)
    : items;
  res.json(filtered);
}));

// POST /api/items - create a new item (admin only)
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { name, category, unitCost, currentStock, lowThreshold, unitType, amazonLink, sources, hideFromPublic } = req.body;

  if (!name || !category || unitCost == null || !unitType) {
    return res.status(400).json({ error: 'name, category, unitCost, and unitType are required.' });
  }

  const links = Item.syncAmazonLink(
    Array.isArray(sources) ? { sources } : { amazonLink: amazonLink || null }
  );

  const item = await Item.create({
    name,
    category,
    unitCost,
    currentStock: currentStock || 0,
    lowThreshold: lowThreshold || 0,
    unitType,
    amazonLink: links.amazonLink,
    sources: links.sources || [],
    hideFromPublic: !!hideFromPublic,
  });

  // Record the starting stock as a transaction too, not just a bare number
  // on the item - otherwise a future "inventory as of date X" report would
  // silently undercount for any item created with stock already on hand.
  if (item.currentStock > 0) {
    await InventoryTransaction.create({
      item: item._id,
      type: 'adjustment',
      quantityDelta: item.currentStock,
      createdBy: req.user._id,
    });
  }

  res.status(201).json(item);
}));

// PATCH /api/items/:id - edit item details (admin only)
// Stock changes should go through adjust-stock so they're recorded as
// transactions - but older app versions send currentStock here, so it's
// still accepted.
const EDITABLE_ITEM_FIELDS = ['name', 'category', 'unitCost', 'currentStock', 'lowThreshold', 'unitType', 'amazonLink', 'sources', 'hideFromPublic'];

router.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await Item.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item not found.' });

  const update = {};
  for (const field of EDITABLE_ITEM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) update[field] = req.body[field];
  }

  const item = await Item.findByIdAndUpdate(req.params.id, Item.syncAmazonLink(update, existing), {
    new: true,
    runValidators: true,
  });
  res.json(item);
}));

// DELETE /api/items/:id - remove an item record (admin only)
// Past InventoryTransaction/PurchaseLog rows referencing this item are left
// in place as historical record - only the Item itself is removed.
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const item = await Item.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  res.json({ success: true });
}));

// POST /api/items/:id/adjust-stock
// Body: { type: 'restock' | 'distributed' | 'adjustment', quantityDelta, cost? }
// Every stock change goes through here so InventoryTransaction stays the
// single source of truth for demand forecasting.
router.post('/:id/adjust-stock', asyncHandler(async (req, res) => {
  const { type, quantityDelta, cost } = req.body;

  if (!type || quantityDelta == null) {
    return res.status(400).json({ error: 'type and quantityDelta are required.' });
  }

  const item = await Item.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  item.currentStock = Math.max(0, item.currentStock + quantityDelta);
  await item.save();

  const transaction = await InventoryTransaction.create({
    item: item._id,
    type,
    quantityDelta,
    cost: cost || null,
    createdBy: req.user._id,
  });

  res.json({ item, transaction });
}));

// GET /api/items/insights/forecast
// Simple demand forecasting: average weekly depletion per item over the
// last 8 weeks, computed on the fly from InventoryTransaction - no separate
// forecasting table needed.
router.get('/insights/forecast', asyncHandler(async (req, res) => {
  const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);

  const distributed = await InventoryTransaction.aggregate([
    { $match: { type: 'distributed', date: { $gte: eightWeeksAgo } } },
    {
      $group: {
        _id: '$item',
        totalDistributed: { $sum: { $abs: '$quantityDelta' } },
      },
    },
  ]);

  const items = await Item.find();
  const forecast = distributed
    .map((d) => {
      const item = items.find((i) => i._id.equals(d._id));
      if (!item) return null;
      const avgPerWeek = d.totalDistributed / 8;
      const weeksOfStockLeft = avgPerWeek > 0 ? item.currentStock / avgPerWeek : null;
      return {
        itemId: item._id,
        name: item.name,
        avgPerWeek: Math.round(avgPerWeek * 10) / 10,
        weeksOfStockLeft: weeksOfStockLeft !== null ? Math.round(weeksOfStockLeft * 10) / 10 : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.avgPerWeek - a.avgPerWeek);

  res.json(forecast);
}));

module.exports = router;
