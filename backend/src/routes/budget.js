const express = require('express');
const MonthlyBudget = require('../models/MonthlyBudget');
const PurchaseLog = require('../models/PurchaseLog');
const Item = require('../models/Item');
const InventoryTransaction = require('../models/InventoryTransaction');
const AuditLog = require('../models/AuditLog');
const { spendingForMonth } = require('../utils/spending');
const { requireAuth, requireAdmin, requireStaff } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Staff only (volunteer or admin) - neighbors don't log purchases or budgets.
router.use(requireAuth, requireStaff);

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const DEFAULT_BUDGET = 2800;

// A month's budget plus everything spent against it (per-item purchases and
// receipts). The current month's row is created the first time anyone asks;
// other months are shown at the default without saving anything until an
// admin sets them.
async function budgetSummary(month, { create = false } = {}) {
  let budget = await MonthlyBudget.findOne({ month });
  if (!budget && create) budget = await MonthlyBudget.create({ month, totalBudget: DEFAULT_BUDGET });
  const budgetOut = budget || { _id: null, month, totalBudget: DEFAULT_BUDGET };
  const { purchases, receipts, amountSpent, spentByCategory } = await spendingForMonth(budget, month);
  return {
    budget: budgetOut,
    isDefault: !budget,
    amountSpent: Math.round(amountSpent * 100) / 100,
    remaining: Math.round((budgetOut.totalBudget - amountSpent) * 100) / 100,
    spentByCategory,
    purchases,
    receipts,
  };
}

async function setBudget(req, res, month) {
  const totalBudget = Number(req.body.totalBudget);
  if (req.body.totalBudget === '' || req.body.totalBudget == null || !Number.isFinite(totalBudget) || totalBudget < 0) {
    return res.status(400).json({ error: 'Enter the budget as a number of 0 or more.' });
  }
  const budget = await MonthlyBudget.findOneAndUpdate(
    { month },
    { totalBudget: Math.round(totalBudget * 100) / 100 },
    { new: true, upsert: true, runValidators: true }
  );
  await AuditLog.create({ user: req.user._id, action: 'update', collectionKey: 'budgets', docId: String(budget._id), fields: ['totalBudget'] });
  res.json(budget);
}

// GET /api/budget/current - this month's budget, spend so far, and remaining
router.get('/current', asyncHandler(async (req, res) => {
  res.json(await budgetSummary(currentMonthKey(), { create: true }));
}));

// GET /api/budget/month/:month - any month, e.g. /api/budget/month/2026-10
router.get('/month/:month', asyncHandler(async (req, res) => {
  const { month } = req.params;
  if (!MONTH_PATTERN.test(month)) return res.status(400).json({ error: 'Month must look like 2026-10.' });
  res.json(await budgetSummary(month, { create: month === currentMonthKey() }));
}));

// PATCH /api/budget/current - admin adjusts this month's total (e.g. a grant came in)
router.patch('/current', requireAdmin, asyncHandler(async (req, res) => setBudget(req, res, currentMonthKey())));

// PATCH /api/budget/month/:month - admin sets any month's total
router.patch('/month/:month', requireAdmin, asyncHandler(async (req, res) => {
  if (!MONTH_PATTERN.test(req.params.month)) return res.status(400).json({ error: 'Month must look like 2026-10.' });
  return setBudget(req, res, req.params.month);
}));

// POST /api/budget/purchases - log a purchase after buying on Amazon
// Body: { itemId, quantity, cost, amazonLink? }
// This also bumps the item's stock via an InventoryTransaction, so you don't
// have to log the purchase AND separately restock the item.
router.post('/purchases', asyncHandler(async (req, res) => {
  const { itemId, quantity, cost, amazonLink } = req.body;

  if (!itemId || !quantity || cost == null) {
    return res.status(400).json({ error: 'itemId, quantity, and cost are required.' });
  }

  const item = await Item.findById(itemId);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  const month = currentMonthKey();
  let budget = await MonthlyBudget.findOne({ month });
  if (!budget) {
    budget = await MonthlyBudget.create({ month, totalBudget: 2800 });
  }

  const purchase = await PurchaseLog.create({
    item: item._id,
    quantity,
    cost,
    amazonLink: amazonLink || item.amazonLink || null,
    markedBy: req.user._id,
    monthlyBudget: budget._id,
  });

  item.currentStock += quantity;
  await item.save();

  await InventoryTransaction.create({
    item: item._id,
    type: 'restock',
    quantityDelta: quantity,
    cost,
    createdBy: req.user._id,
  });

  res.status(201).json(purchase);
}));

module.exports = router;
