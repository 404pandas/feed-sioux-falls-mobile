// Switches the people-served numbers from test data to real hand counts.
//
//   1. Saves the CURRENT total (from the test data the founder approved as
//      the estimate) as a labeled estimate covering the time before
//      counting started - or a number you pass with --estimate.
//   2. Backs up every existing people-served count to a JSON file.
//   3. Deletes those counts (nothing else: events, items, budgets, surveys
//      and everything else stay exactly as they are).
//   4. Adds one real count per outreach date from the CSV (date,people),
//      attached to the outreach event on that date - or a new event at
//      10:00 am at Heritage Park if there isn't one.
//
// Nothing changes unless you add --apply. Run it without first: it prints
// exactly what it would do.
//
//   node src/utils/importHeadcounts.js --file data/headcounts.csv
//   node src/utils/importHeadcounts.js --file data/headcounts.csv --apply
//
// Options:
//   --estimate N        use N as the estimate instead of the current total
//   --through YYYY-MM-DD last day the estimate covers (default: the day
//                        before the first date in the CSV)
//   --keep-after YYYY-MM-DD  keep counts from events AFTER this date (e.g.
//                        real counts already tapped in the app after the
//                        spreadsheet ends); they stay as real counts and are
//                        not part of the estimate
//   --force             replace an estimate that already exists
//
// Needs MONGODB_URI (same .env as the server).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');
const DistributionEvent = require('../models/DistributionEvent');
const PersonServedTally = require('../models/PersonServedTally');
const HistoricalEstimate = require('../models/HistoricalEstimate');

const TZ = 'America/Chicago';
const OUTREACH_LOCATION = 'Heritage Park, 330 N Weber Ave, Sioux Falls, SD 57103';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const flag = (name) => process.argv.includes(`--${name}`);

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

// Minutes between UTC and Sioux Falls time on a given day (-300 in summer,
// -360 in winter), so dates match the way people in Sioux Falls read them.
function chicagoOffsetMinutes(utcDate) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(utcDate)
    .find((p) => p.type === 'timeZoneName').value; // e.g. "GMT-5"
  const m = part.match(/GMT([+-]\d+)(?::(\d+))?/);
  return m ? Number(m[1]) * 60 + Math.sign(Number(m[1])) * Number(m[2] || 0) : 0;
}

// A wall-clock time in Sioux Falls -> the real moment (Date).
function chicagoTime(ymd, hour = 0) {
  const [y, mo, d] = ymd.split('-').map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, hour));
  return new Date(guess.getTime() - chicagoOffsetMinutes(guess) * 60000);
}

function chicagoDay(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date); // YYYY-MM-DD
}

function addDays(ymd, n) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const header = lines.shift().toLowerCase().split(',').map((h) => h.trim());
  const di = header.indexOf('date');
  const pi = header.indexOf('people');
  if (di < 0 || pi < 0) fail('The CSV needs a header row with "date" and "people" columns.');
  const rows = lines.map((line, n) => {
    const cells = line.split(',').map((c) => c.trim());
    const date = cells[di];
    const people = Number(cells[pi]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`Line ${n + 2}: date "${date}" should look like 2026-07-18.`);
    if (!Number.isInteger(people) || people <= 0) fail(`Line ${n + 2}: people "${cells[pi]}" should be a whole number above 0.`);
    return { date, people };
  });
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.date)) fail(`${r.date} is in the CSV twice. Combine it into one line.`);
    seen.add(r.date);
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

const fmt = (n) => n.toLocaleString('en-US');

async function main() {
  const file = arg('file');
  if (!file) fail('Pass the CSV with --file, e.g. --file data/headcounts.csv');
  if (!process.env.MONGODB_URI) fail('MONGODB_URI is not set (put it in .env, like the server uses).');
  const apply = flag('apply');
  const rows = readCsv(path.resolve(file));
  if (!rows.length) fail('The CSV has no rows.');

  const keepAfter = arg('keep-after');
  if (keepAfter && !/^\d{4}-\d{2}-\d{2}$/.test(keepAfter)) fail('--keep-after should look like 2026-10-02.');
  const through = arg('through') || addDays(rows[0].date, -1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through)) fail('--through should look like 2026-07-17.');

  await mongoose.connect(process.env.MONGODB_URI);

  // --- What's there now ---
  const tallies = await PersonServedTally.find().populate('distributionEvent', 'date location').lean();
  const keepCutoff = keepAfter ? chicagoTime(addDays(keepAfter, 1)) : null;
  const isKept = (t) => keepCutoff && t.distributionEvent && new Date(t.distributionEvent.date) >= keepCutoff;
  const toDelete = tallies.filter((t) => !isKept(t));
  const toKeep = tallies.filter(isKept);
  const currentTotal = toDelete.reduce((s, t) => s + t.countIncrement, 0);

  const byDay = new Map();
  for (const t of tallies) {
    const day = t.distributionEvent ? chicagoDay(new Date(t.distributionEvent.date)) : '(event deleted)';
    byDay.set(day, (byDay.get(day) || 0) + t.countIncrement);
  }

  const existingEstimate = await HistoricalEstimate.findOne().lean();
  const estimateArg = arg('estimate');
  const estimate = estimateArg !== undefined ? Number(estimateArg) : currentTotal;
  if (!Number.isInteger(estimate) || estimate < 0) fail('--estimate should be a whole number.');

  const admin = await User.findOne({ role: 'admin', active: true }).sort({ createdAt: 1 });
  if (!admin) fail('No active admin found to record the import under.');

  // --- Match each date to its outreach event ---
  const plan = [];
  for (const r of rows) {
    const start = chicagoTime(r.date);
    const end = chicagoTime(addDays(r.date, 1));
    const event = await DistributionEvent.findOne({ date: { $gte: start, $lt: end } }).sort({ date: 1 }).lean();
    plan.push({ ...r, event });
  }

  // --- Report ---
  console.log('\nPeople-served counts in the database now:');
  if (!byDay.size) console.log('  (none)');
  for (const [day, n] of [...byDay].sort()) console.log(`  ${day}  ${fmt(n)}`);
  console.log(`  Total: ${fmt(tallies.reduce((s, t) => s + t.countIncrement, 0))} from ${tallies.length} count rows`);
  if (toKeep.length) console.log(`  Keeping ${toKeep.length} rows from events after ${keepAfter} (${fmt(toKeep.reduce((s, t) => s + t.countIncrement, 0))} people) as real counts.`);

  if (existingEstimate && !flag('force')) {
    console.log(`\nEstimate: keeping the one already saved, ${fmt(existingEstimate.peopleServed)} people through ${existingEstimate.throughDate.toISOString().slice(0, 10)}.`);
    console.log('  (Add --force to replace it. Without that, running this again never turns real counts into "estimate".)');
  } else {
    console.log(`\nEstimate for everything through ${through}: ${fmt(estimate)} people${estimateArg !== undefined ? ' (from --estimate)' : ' (the current total above)'}`);
  }

  console.log('\nReal hand counts to add:');
  for (const p of plan) {
    const where = p.event ? `existing event, ${p.event.location || 'no location'}` : 'new event at 10:00 am, Heritage Park';
    const weekday = new Date(`${p.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    console.log(`  ${p.date} (${weekday})  ${String(p.people).padStart(4)} people  -> ${where}`);
  }
  const countedTotal = rows.reduce((s, r) => s + r.people, 0) + toKeep.reduce((s, t) => s + t.countIncrement, 0);
  console.log(`  Hand-counted total after import: ${fmt(countedTotal)}`);
  console.log(`\nWebsite and app will show: ${fmt(countedTotal)} hand-counted since ${rows[0].date}, plus about ${fmt(existingEstimate && !flag('force') ? existingEstimate.peopleServed : estimate)} estimated before that.`);

  if (!apply) {
    console.log('\nDry run - nothing was changed. Add --apply to do it.\n');
    await mongoose.disconnect();
    return;
  }
  if (existingEstimate && !flag('force') && estimateArg !== undefined) {
    fail('An estimate already exists. Add --force to replace it with --estimate.');
  }

  // --- Apply ---
  const backupDir = path.resolve(__dirname, '../../backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `people-served-before-import-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ takenAt: new Date(), tallies, estimate: existingEstimate }, null, 2));
  console.log(`\n1. Backed up ${tallies.length} count rows to ${backupFile}`);

  if (!existingEstimate || flag('force')) {
    await HistoricalEstimate.deleteMany({});
    await HistoricalEstimate.create({
      peopleServed: estimate,
      throughDate: new Date(`${through}T00:00:00Z`),
      note: `Estimate approved by the founder for people served before hand-counting began on ${rows[0].date}. Saved by the headcount import on ${new Date().toISOString().slice(0, 10)}.`,
    });
    console.log(`2. Saved the estimate: ${fmt(estimate)} people through ${through}`);
  } else {
    console.log('2. Kept the existing estimate');
  }

  const del = await PersonServedTally.deleteMany({ _id: { $in: toDelete.map((t) => t._id) } });
  console.log(`3. Removed ${del.deletedCount} old count rows`);

  let created = 0;
  for (const p of plan) {
    let event = p.event;
    if (!event) {
      event = await DistributionEvent.create({
        date: chicagoTime(p.date, 10),
        location: OUTREACH_LOCATION,
        details: 'Added by the headcount import from the volunteer count sheet.',
        createdBy: admin._id,
      });
      created += 1;
    }
    await PersonServedTally.create({
      distributionEvent: event._id,
      countIncrement: p.people,
      timestamp: event.date,
      createdBy: admin._id,
      source: 'import',
    });
  }
  console.log(`4. Added ${plan.length} real counts (${created} new events created)`);

  const check = await PersonServedTally.aggregate([{ $group: { _id: null, total: { $sum: '$countIncrement' } } }]);
  console.log(`\nDone. Hand-counted total in the database: ${fmt(check[0]?.total || 0)}`);
  console.log('The website and app pick this up within a minute.\n');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('\n✗ Import stopped:', err.message);
  console.error('  If it stopped after step 3, the old counts are in the backup file in backend/backups/.\n');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
