const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['hygiene', 'winter', 'other'],
      required: true,
    },
    unitCost: { type: Number, required: true, min: 0 },
    currentStock: { type: Number, required: true, min: 0, default: 0 },
    lowThreshold: { type: Number, required: true, min: 0 },
    unitType: { type: String, required: true, trim: true }, // e.g. "bar", "pair", "bottle"
    // Direct Amazon product URL. Used to build the "Buy Now" deep link.
    // Optional - if missing, the Buy Now button just doesn't render for that item.
    amazonLink: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

itemSchema.virtual('isLowStock').get(function isLowStock() {
  return this.currentStock <= this.lowThreshold;
});
itemSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Item', itemSchema);
