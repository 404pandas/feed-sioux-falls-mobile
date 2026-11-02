const PurchaseLog = require('../models/PurchaseLog');
const Receipt = require('../models/Receipt');

// All money spent, from both places it's recorded:
//   - PurchaseLog: one item bought (the website's "Log a purchase")
//   - Receipt: a whole shopping trip, with its photo
// Budgets, reports, and charts all read spending through here so they agree.
// Each row: { date, cost, category, label, kind }.
function purchaseRow(p) {
  return { date: p.date, cost: p.cost, category: p.item?.category || 'other', label: p.item?.name || 'Unknown item', kind: 'purchase' };
}

function receiptRow(r) {
  return { date: r.date, cost: r.total, category: r.category || 'other', label: r.store, kind: 'receipt' };
}

async function spendingBetween(start, end) {
  const [purchases, receipts] = await Promise.all([
    PurchaseLog.find({ date: { $gte: start, $lte: end } }).populate('item', 'name category'),
    Receipt.find({ date: { $gte: start, $lte: end } }),
  ]);
  return [...purchases.map(purchaseRow), ...receipts.map(receiptRow)].sort((a, b) => a.date - b.date);
}

// One budget month: purchases are tied to it by monthlyBudget, receipts by
// their month string.
async function spendingForMonth(budget, month) {
  const [purchases, receipts] = await Promise.all([
    budget?._id ? PurchaseLog.find({ monthlyBudget: budget._id }).populate('item', 'name category').sort({ date: -1 }) : [],
    Receipt.find({ month }).sort({ date: -1, createdAt: -1 }).populate('uploadedBy', 'name'),
  ]);
  const rows = [...purchases.map(purchaseRow), ...receipts.map(receiptRow)];
  const amountSpent = rows.reduce((sum, r) => sum + r.cost, 0);
  const spentByCategory = rows.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + r.cost;
    return acc;
  }, {});
  return { purchases, receipts, amountSpent, spentByCategory };
}

module.exports = { spendingBetween, spendingForMonth };
