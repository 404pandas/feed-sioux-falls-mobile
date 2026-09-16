const express = require('express');
const MonthlyBudget = require('../models/MonthlyBudget');
const PurchaseLog = require('../models/PurchaseLog');
const Item = require('../models/Item');
const InventoryTransaction = require('../models/InventoryTransaction');
const { requireAuth, requireAdmin, requireStaff } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Staff only (volunteer or admin) - neighbors don't log purchases or budgets.
router.use(requireAuth, requireStaff);

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// GET /api/budget/current - this month's budget, spend so far, and remaining
router.get('/current', asyncHandler(async (req, res) => {
  const month = currentMonthKey();

  let budget = await MonthlyBudget.findOne({ month });
  if (!budget) {
    // Auto-create this month's budget row at the default $2,800 the first
    // time anyone asks for it, so nobody has to remember to set it up.
    budget = await MonthlyBudget.create({ month, totalBudget: 2800 });
  }

  const purchases = await PurchaseLog.find({ monthlyBudget: budget._id }).populate('item', 'name category');
  const amountSpent = purchases.reduce((sum, p) => sum + p.cost, 0);

  const spentByCategory = purchases.reduce((acc, p) => {
    const cat = p.item?.category || 'other';
    acc[cat] = (acc[cat] || 0) + p.cost;
    return acc;
  }, {});

  res.json({
    budget,
    amountSpent,
    remaining: budget.totalBudget - amountSpent,
    spentByCategory,
    purchases,
  });
}));

// PATCH /api/budget/current - admin adjusts this month's total (e.g. a grant came in)
router.patch('/current', requireAdmin, asyncHandler(async (req, res) => {
  const { totalBudget } = req.body;
  const month = currentMonthKey();

  const budget = await MonthlyBudget.findOneAndUpdate(
    { month },
    { totalBudget },
    { new: true, upsert: true, runValidators: true }
  );

  res.json(budget);
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
