const mongoose = require('mongoose');

// One document per tap (or batch tap, e.g. +5). Deliberately does NOT track
// which items a person took - too slow to log mid-event. Kept separate from
// DistributionEvent.details so many volunteers can tap concurrently without
// editing the same document.
const personServedTallySchema = new mongoose.Schema(
  {
    distributionEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DistributionEvent',
      required: true,
    },
    // Positive for a normal tap (or a batch tap, e.g. +5), negative for a
    // correction (an accidental over-tap, or an admin's end-of-event
    // adjustment). Never zero - there's nothing to record.
    countIncrement: {
      type: Number,
      required: true,
      default: 1,
      validate: {
        validator: (v) => Number.isInteger(v) && v !== 0,
        message: 'countIncrement must be a nonzero whole number',
      },
    },
    timestamp: { type: Date, required: true, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    synced: { type: Boolean, default: true },
    // How this count got here: 'tap' = the people-served counter during an
    // event (the default, and what every app version sends); 'import' =
    // copied in from a volunteer's paper/spreadsheet log for that event.
    // Both are real hand counts - estimates never go in this collection.
    source: { type: String, enum: ['tap', 'import'], default: 'tap' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PersonServedTally', personServedTallySchema);
