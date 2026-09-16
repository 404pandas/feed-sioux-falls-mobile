const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 1 }, // in whole dollars
    stripePaymentIntentId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed'],
      default: 'pending',
    },
    date: { type: Date, default: Date.now },
    donorName: { type: String, trim: true, default: null },
    donorEmail: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Donation', donationSchema);
