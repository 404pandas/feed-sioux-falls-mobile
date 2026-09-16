const express = require('express');
const DistributionEvent = require('../models/DistributionEvent');
const PersonServedTally = require('../models/PersonServedTally');
const InventoryTransaction = require('../models/InventoryTransaction');
const PurchaseLog = require('../models/PurchaseLog');
const MonthlyBudget = require('../models/MonthlyBudget');
const Donation = require('../models/Donation');
const Item = require('../models/Item');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Reports are for grant applications and board updates - admins only.
router.use(requireAuth, requireAdmin);

// Buckets a date into a label for time-series charts. Weeks are keyed by
// their Sunday (matching the existing weekly-report convention), months by
// "Mon YYYY", years by "YYYY" - always sortable as plain strings/dates.
function bucketLabel(date, groupBy) {
  const d = new Date(date);
  if (groupBy === 'year') {
    return String(d.getFullYear());
  }
  if (groupBy === 'week') {
    const sunday = new Date(d);
    sunday.setDate(d.getDate() - d.getDay());
    sunday.setHours(0, 0, 0, 0);
    return sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  // month (default)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Groups by bucketLabel, in first-seen order (callers pass already
// date-sorted data), summing `valueFn(doc)` per bucket.
function bucketSum(docs, dateField, groupBy, valueFn) {
  const order = [];
  const totals = new Map();
  for (const doc of docs) {
    const label = bucketLabel(doc[dateField], groupBy);
    if (!totals.has(label)) {
      totals.set(label, 0);
      order.push(label);
    }
    totals.set(label, totals.get(label) + valueFn(doc));
  }
  return order.map((label) => ({ label, value: totals.get(label) }));
}

// Shared logic for both weekly and monthly reports - just a different date range.
async function buildReport(startDate, endDate) {
  const events = await DistributionEvent.find({ date: { $gte: startDate, $lte: endDate } });
  const eventIds = events.map((e) => e._id);

  const tallies = await PersonServedTally.find({ distributionEvent: { $in: eventIds } });
  const peopleServed = tallies.reduce((sum, t) => sum + t.countIncrement, 0);

  const purchases = await PurchaseLog.find({ date: { $gte: startDate, $lte: endDate } }).populate('item', 'name');
  const totalSpent = purchases.reduce((sum, p) => sum + p.cost, 0);

  const distributedTx = await InventoryTransaction.aggregate([
    { $match: { type: 'distributed', date: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: '$item', totalDistributed: { $sum: { $abs: '$quantityDelta' } } } },
    { $sort: { totalDistributed: -1 } },
    { $limit: 5 },
  ]);

  const items = await Item.find({ _id: { $in: distributedTx.map((d) => d._id) } });
  const topNeededItems = distributedTx.map((d) => ({
    name: items.find((i) => i._id.equals(d._id))?.name || 'Unknown item',
    quantityDistributed: d.totalDistributed,
  }));

  return {
    periodStart: startDate,
    periodEnd: endDate,
    eventsHeld: events.length,
    peopleServed,
    totalSpent,
    topNeededItems,
    eventDetails: events.map((e) => ({ date: e.date, location: e.location, details: e.details })),
  };
}

// GET /api/reports/weekly?date=2026-09-15 (any date in the target week; defaults to this week)
router.get('/weekly', asyncHandler(async (req, res) => {
  const anchor = req.query.date ? new Date(req.query.date) : new Date();
  const dayOfWeek = anchor.getDay();
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const report = await buildReport(start, end);
  res.json(report);
}));

// GET /api/reports/monthly?month=2026-09 (defaults to current month)
router.get('/monthly', asyncHandler(async (req, res) => {
  const monthStr = req.query.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const report = await buildReport(start, end);

  const budget = await MonthlyBudget.findOne({ month: monthStr });
  report.budgetTotal = budget?.totalBudget || 2800;
  report.budgetRemaining = report.budgetTotal - report.totalSpent;

  res.json(report);
}));

// GET /api/reports/custom?start=ISO&end=ISO&groupBy=week|month|year
// Built for the grant-report builder: one flexible endpoint returning every
// section the mobile app might chart, over any date range. The client
// decides which sections to actually display/export - fetching everything
// here is simpler than a section-selection query param, and cheap at this
// org's data volume.
//
// A methodology note baked into the response rather than left implicit:
// peopleServed is a TALLY of taps, not a count of unique/unduplicated
// individuals - this system has no way to tell a repeat visitor from a new
// one. Funders often want that distinction, so the report is explicit about
// what it can and can't claim.
router.get('/custom', asyncHandler(async (req, res) => {
  const { start, end, groupBy = 'month' } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: 'start and end are required (ISO date strings).' });
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  const events = await DistributionEvent.find({ date: { $gte: startDate, $lte: endDate } }).sort({ date: 1 });
  const eventIds = events.map((e) => e._id);

  const tallies = await PersonServedTally.find({ distributionEvent: { $in: eventIds } }).sort({ timestamp: 1 });
  const peopleServed = tallies.reduce((sum, t) => sum + t.countIncrement, 0);
  const peopleServedByPeriod = bucketSum(tallies, 'timestamp', groupBy, (t) => t.countIncrement);

  const eventsByPeriod = bucketSum(events, 'date', groupBy, () => 1);

  const purchases = await PurchaseLog.find({ date: { $gte: startDate, $lte: endDate } }).populate('item', 'name category').sort({ date: 1 });
  const totalSpent = purchases.reduce((sum, p) => sum + p.cost, 0);
  const spendByPeriod = bucketSum(purchases, 'date', groupBy, (p) => p.cost);
  const spendByCategory = Array.from(
    purchases.reduce((map, p) => {
      const cat = p.item?.category || 'other';
      map.set(cat, (map.get(cat) || 0) + p.cost);
      return map;
    }, new Map())
  ).map(([category, amount]) => ({ category, amount }));

  const donations = await Donation.find({ date: { $gte: startDate, $lte: endDate }, status: 'succeeded' }).sort({ date: 1 });
  const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);
  const donationsByPeriod = bucketSum(donations, 'date', groupBy, (d) => d.amount);

  const distributedTx = await InventoryTransaction.aggregate([
    { $match: { type: 'distributed', date: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: '$item', totalDistributed: { $sum: { $abs: '$quantityDelta' } } } },
    { $sort: { totalDistributed: -1 } },
    { $limit: 10 },
  ]);
  const distributedItems = await Item.find({ _id: { $in: distributedTx.map((d) => d._id) } });
  const topItems = distributedTx.map((d) => ({
    name: distributedItems.find((i) => i._id.equals(d._id))?.name || 'Unknown item',
    quantityDistributed: d.totalDistributed,
  }));

  // Current stock snapshot - deliberately "as of now", not reconstructed
  // for a past date. Historical InventoryTransaction rows don't capture an
  // item's starting stock at creation time, so a true as-of-date
  // reconstruction would silently undercount for any item created with
  // stock already on hand. "Most distributed items" above is the
  // trustworthy historical view; this is the trustworthy current one.
  const currentItems = await Item.find().sort({ category: 1, name: 1 });
  const inventorySnapshot = currentItems.map((i) => ({
    name: i.name,
    category: i.category,
    unitType: i.unitType,
    currentStock: i.currentStock,
    lowThreshold: i.lowThreshold,
    isLow: i.currentStock <= i.lowThreshold,
  }));

  const eventsHeld = events.length;

  res.json({
    periodStart: startDate,
    periodEnd: endDate,
    groupBy,
    summary: {
      eventsHeld,
      peopleServed,
      totalSpent,
      totalDonations,
      avgPeoplePerEvent: eventsHeld > 0 ? Math.round((peopleServed / eventsHeld) * 10) / 10 : 0,
      costPerPersonServed: peopleServed > 0 ? Math.round((totalSpent / peopleServed) * 100) / 100 : null,
    },
    methodologyNote:
      'peopleServed is a tally of visits recorded by staff, not a count of unduplicated individuals - repeat visitors are not distinguished from new ones.',
    peopleServedByPeriod,
    eventsByPeriod,
    spendByPeriod,
    spendByCategory,
    donationsByPeriod,
    topItems,
    inventorySnapshot,
  });
}));

module.exports = router;
