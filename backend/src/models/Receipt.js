const mongoose = require('mongoose');

// What a receipt's money went to. The first three match item categories;
// 'operations' is spending that isn't inventory (gas, bins, printing).
const RECEIPT_CATEGORIES = ['hygiene', 'winter', 'other', 'operations'];

// A store receipt: the money side of a shopping trip, counted against the
// budget for the month it's dated. The photo is kept in ReceiptPhoto (so
// lists never load images) and replaces the paper copy.
//
// `lines` are the inventory items the trip restocked. They're added to stock
// once, when the receipt is saved, and can't be changed afterward - fix
// stock with +/- like any other count, so the inventory history stays true.
const receiptSchema = new mongoose.Schema(
  {
    store: { type: String, required: true, trim: true, maxlength: 100 },
    date: { type: Date, required: true },
    // "YYYY-MM" the receipt counts toward, taken from the date as typed (not
    // the server's time zone), so a receipt from the 31st stays in its month.
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/, index: true },
    total: { type: Number, required: true, min: 0 },
    category: { type: String, enum: RECEIPT_CATEGORIES, default: 'other' },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    hasPhoto: { type: Boolean, default: false },
    lines: [
      {
        _id: false,
        item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
        name: { type: String, trim: true }, // kept in case the item is deleted later
        quantity: { type: Number, min: 1 },
      },
    ],
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

const Receipt = mongoose.model('Receipt', receiptSchema);
Receipt.CATEGORIES = RECEIPT_CATEGORIES;

module.exports = Receipt;
