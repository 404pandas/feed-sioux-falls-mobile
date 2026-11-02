const mongoose = require('mongoose');

// The picture of a receipt, kept apart from Receipt so lists and totals never
// load image data. Phones shrink photos to about 1600px before sending
// (roughly 200-400 KB), readable enough to throw the paper away.
const receiptPhotoSchema = new mongoose.Schema(
  {
    receipt: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt', required: true, unique: true },
    contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ReceiptPhoto', receiptPhotoSchema);
