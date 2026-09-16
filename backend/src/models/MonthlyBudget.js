const mongoose = require('mongoose');

// One document per calendar month, e.g. month: "2026-09".
// amountSpent is NOT stored directly - it's computed by summing PurchaseLog
// entries for this budget, so it can never drift out of sync from the log.
const monthlyBudgetSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, unique: true }, // "YYYY-MM"
    totalBudget: { type: Number, required: true, default: 2800 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MonthlyBudget', monthlyBudgetSchema);
