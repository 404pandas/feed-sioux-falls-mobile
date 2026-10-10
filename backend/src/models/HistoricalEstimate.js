const mongoose = require('mongoose');

// People served BEFORE volunteers started hand-counting at every outreach.
// Those years were never tallied one person at a time, so Feed Sioux Falls
// uses an estimate for them. It's kept as one clearly labeled number here -
// never as fake tally rows - so it can't be mistaken for a real count, and
// date-range reports (which only use real tallies) never include it.
//
// The public totals show it as "about N estimated before <date>" next to
// the hand-counted number. Normally there is exactly one of these.
const historicalEstimateSchema = new mongoose.Schema(
  {
    peopleServed: { type: Number, required: true, min: 0 },
    // Last day the estimate covers. Hand counts start the day after.
    throughDate: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HistoricalEstimate', historicalEstimateSchema);
