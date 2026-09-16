const mongoose = require('mongoose');

// Every change to an item's stock goes through here, so we can compute
// "how fast does this item deplete" (demand forecasting) from history
// instead of needing a separate forecasting table.
const inventoryTransactionSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    type: {
      type: String,
      enum: ['restock', 'distributed', 'adjustment'],
      required: true,
    },
    // Positive for restock, negative for distributed/adjustment-down.
    quantityDelta: { type: Number, required: true },
    cost: { type: Number, default: null }, // only set on restock
    date: { type: Date, required: true, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    synced: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
