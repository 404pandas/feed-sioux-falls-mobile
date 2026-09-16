const express = require('express');
const DistributionEvent = require('../models/DistributionEvent');
const PersonServedTally = require('../models/PersonServedTally');
const { requireAuth, requireAdmin, requireStaff } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Staff only (volunteer or admin) - neighbors don't start events or tally.
router.use(requireAuth, requireStaff);

// POST /api/events - start a new distribution event (usually one per outreach day)
router.post('/', asyncHandler(async (req, res) => {
  const { location, details } = req.body;
  const event = await DistributionEvent.create({
    location,
    details: details || '',
    createdBy: req.user._id,
  });
  res.status(201).json(event);
}));

// GET /api/events - list events
// Query params (all optional):
//   start, end (ISO timestamps) - only events with date in [start, end), soonest first.
//     Used for both "what's happening on this exact day" (caller passes that
//     day's local midnight-to-midnight) and calendar-picker date search.
//   upcoming=true - only events from now onward, soonest first (small limit -
//     just enough to find the next scheduled event).
//   (default, no params) - only events that have already happened, most
//     recent first. This is what "Past Events" should show - with 200
//     recurring outreach events seeded years into the future, sorting all
//     events by date descending with no filter surfaces the *farthest*
//     future ones, not anything resembling "past".
router.get('/', asyncHandler(async (req, res) => {
  const { start, end, upcoming } = req.query;

  let filter = {};
  let sort = { date: -1 };
  let limit = 100;

  if (start || end) {
    filter.date = {};
    if (start) filter.date.$gte = new Date(start);
    if (end) filter.date.$lt = new Date(end);
    sort = { date: 1 };
  } else if (upcoming === 'true') {
    filter.date = { $gte: new Date() };
    sort = { date: 1 };
    limit = 10;
  } else {
    filter.date = { $lte: new Date() };
  }

  const events = await DistributionEvent.find(filter).sort(sort).limit(limit);
  res.json(events);
}));

// GET /api/events/:id - one event plus its tally total
router.get('/:id', asyncHandler(async (req, res) => {
  const event = await DistributionEvent.findById(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });

  const tallies = await PersonServedTally.find({ distributionEvent: event._id });
  const totalServed = tallies.reduce((sum, t) => sum + t.countIncrement, 0);

  res.json({ event, totalServed, tallyCount: tallies.length });
}));

// PATCH /api/events/:id - admin edits the misc details (e.g. total guests, notes)
router.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { details, location } = req.body;
  const event = await DistributionEvent.findByIdAndUpdate(
    req.params.id,
    { details, location },
    { new: true, runValidators: true }
  );
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  res.json(event);
}));

// POST /api/events/:id/tally - the "+1 Person Served" tap, a live correction
// (negative countIncrement), or an admin's end-of-event count adjustment.
// Body: { countIncrement?, timestamp?, clientId? }
// clientId lets the offline queue avoid duplicate submits if a tap is
// retried after a dropped connection (see mobile sync docs).
router.post('/:id/tally', asyncHandler(async (req, res) => {
  const { countIncrement, timestamp } = req.body;
  const delta = countIncrement ?? 1;

  if (delta === 0) {
    return res.status(400).json({ error: 'countIncrement must not be zero.' });
  }

  const event = await DistributionEvent.findById(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });

  if (delta < 0) {
    const existing = await PersonServedTally.find({ distributionEvent: event._id });
    const currentTotal = existing.reduce((sum, t) => sum + t.countIncrement, 0);
    if (currentTotal + delta < 0) {
      return res.status(400).json({
        error: `Only ${currentTotal} currently recorded - can't reduce by ${Math.abs(delta)}.`,
      });
    }
  }

  const tally = await PersonServedTally.create({
    distributionEvent: event._id,
    countIncrement: delta,
    timestamp: timestamp || Date.now(),
    createdBy: req.user._id,
  });

  res.status(201).json(tally);
}));

module.exports = router;
