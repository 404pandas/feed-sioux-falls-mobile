const mongoose = require('mongoose');

const purchaseLogSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    quantity: { type: Number, required: true, min: 1 },
    cost: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    amazonLink: { type: String, trim: true, default: null },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    monthlyBudget: { type: mongoose.Schema.Types.ObjectId, ref: 'MonthlyBudget', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PurchaseLog', purchaseLogSchema);
