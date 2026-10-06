const express = require('express');
const rateLimit = require('express-rate-limit');
const DistributionEvent = require('../models/DistributionEvent');
const PersonServedTally = require('../models/PersonServedTally');
const InventoryTransaction = require('../models/InventoryTransaction');
const SurveyResponse = require('../models/SurveyResponse');
const Item = require('../models/Item');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Public, no login. Everything here is safe to show anyone on the internet:
// totals and item NAMES only - never stock counts, costs, people, survey
// answers, budgets, or donations.
//
// Built once a minute and served from memory, so a busy day (a survey link
// going around Facebook) doesn't turn into thousands of database queries.

const CACHE_MS = 60 * 1000;
let cache = { at: 0, data: null, building: null };

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests. Please try again in a minute.' },
});

async function sumServed(match = {}) {
  const [row] = await PersonServedTally.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$countIncrement' } } },
  ]);
  return Math.max(0, row?.total || 0);
}

async function sumDistributed(since) {
  const match = { type: 'distributed' };
  if (since) match.date = { $gte: since };
  const [row] = await InventoryTransaction.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$quantityDelta' } } },
  ]);
  // "Handed out" rows are always negative, so the sum is too.
  return Math.abs(row?.total || 0);
}

// Only the store and link go out - not prices, which are internal.
function publicSources(item) {
  return (item.sources || [])
    .filter((s) => s.url)
    .map((s) => ({ store: s.store, url: s.url, note: s.note || '' }));
}

async function buildSummary() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);

  const [pastEvents, monthEventIds, yearEventIds, nextEvents, items, surveys] = await Promise.all([
    DistributionEvent.countDocuments({ date: { $lte: now } }),
    DistributionEvent.find({ date: { $gte: monthStart, $lte: now } }).distinct('_id'),
    DistributionEvent.find({ date: { $gte: yearStart, $lte: now } }).distinct('_id'),
    DistributionEvent.find({ date: { $gte: now } }).sort({ date: 1 }).limit(1).lean(),
    Item.find({ hideFromPublic: { $ne: true } }),
    SurveyResponse.estimatedDocumentCount(),
  ]);

  const [servedAllTime, servedThisMonth, servedThisYear, itemsGivenAllTime, itemsGivenThisMonth, demand] =
    await Promise.all([
      sumServed(),
      sumServed({ distributionEvent: { $in: monthEventIds } }),
      sumServed({ distributionEvent: { $in: yearEventIds } }),
      sumDistributed(),
      sumDistributed(monthStart),
      InventoryTransaction.aggregate([
        { $match: { type: 'distributed', date: { $gte: eightWeeksAgo } } },
        { $group: { _id: '$item', given: { $sum: '$quantityDelta' } } },
      ]),
    ]);

  const givenById = new Map(demand.map((d) => [String(d._id), Math.abs(d.given)]));

  // "Needs right now": out of stock first, then low. Status only - the
  // public never sees exact counts.
  const needs = items
    .filter((i) => i.currentStock <= i.lowThreshold)
    .map((i) => ({
      _id: i._id,
      name: i.name,
      category: i.category,
      unitType: i.unitType,
      status: i.currentStock <= 0 ? 'out' : 'low',
      sources: publicSources(i),
      given: givenById.get(String(i._id)) || 0,
    }))
    .sort((a, b) => (a.status === b.status ? b.given - a.given : a.status === 'out' ? -1 : 1))
    .map(({ given, ...rest }) => rest);

  // "Most needed": what goes out the fastest over the last 8 weeks.
  const mostNeeded = items
    .map((i) => ({ item: i, given: givenById.get(String(i._id)) || 0 }))
    .filter((x) => x.given > 0)
    .sort((a, b) => b.given - a.given)
    .slice(0, 8)
    .map(({ item, given }) => ({
      _id: item._id,
      name: item.name,
      category: item.category,
      unitType: item.unitType,
      givenLast8Weeks: given,
      status: item.currentStock <= 0 ? 'out' : item.currentStock <= item.lowThreshold ? 'low' : 'ok',
      sources: publicSources(item),
    }));

  const next = nextEvents[0];

  return {
    peopleServed: { allTime: servedAllTime, thisYear: servedThisYear, thisMonth: servedThisMonth },
    itemsGiven: { allTime: itemsGivenAllTime, thisMonth: itemsGivenThisMonth },
    outreachEvents: pastEvents,
    surveysCollected: surveys,
    nextOutreach: next ? { date: next.date, location: next.location } : null,
    needs,
    mostNeeded,
    updatedAt: now.toISOString(),
  };
}

// GET /api/public/summary
router.get('/summary', publicLimiter, asyncHandler(async (req, res) => {
  if (!cache.data || Date.now() - cache.at > CACHE_MS) {
    // One rebuild at a time, even if many requests arrive together.
    if (!cache.building) {
      cache.building = buildSummary()
        .then((data) => {
          cache = { at: Date.now(), data, building: null };
        })
        .catch((err) => {
          cache.building = null;
          throw err;
        });
    }
    await cache.building;
  }
  res.set('Cache-Control', 'public, max-age=60');
  res.json(cache.data);
}));

module.exports = router;
