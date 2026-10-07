const mongoose = require('mongoose');

// Where an item can be bought. Several per item, so admins can compare
// Amazon vs Temu vs Dollar General and the public "what we need" list can
// point donors at the cheapest place to buy it.
const STORES = ['amazon', 'temu', 'dollar_general', 'walmart', 'target', 'costco', 'sams_club', 'other'];

const sourceSchema = new mongoose.Schema(
  {
    store: { type: String, enum: STORES, required: true, default: 'other' },
    url: { type: String, trim: true, required: true, maxlength: 2000 },
    // Price for one pack/listing at that store, and how many units are in
    // it - so "$12.99 for 50" can be compared per unit across stores.
    price: { type: Number, min: 0, default: null },
    unitsPerPack: { type: Number, min: 1, default: null },
    // Free text, e.g. "Store name" for 'other', or "buy in store only".
    note: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { _id: true }
);

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
    // Kept for older app versions, which only know about one Amazon link and
    // use it for their "Buy Now" button. Always mirrors the first Amazon
    // entry in `sources` (see syncAmazonLink) - new code should use sources.
    amazonLink: { type: String, trim: true, default: null },
    sources: { type: [sourceSchema], default: [] },
    // Hide an item from the public "What we need" list (e.g. something only
    // handed out on request). Defaults to shown.
    hideFromPublic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

itemSchema.virtual('isLowStock').get(function isLowStock() {
  return this.currentStock <= this.lowThreshold;
});
itemSchema.set('toJSON', { virtuals: true });

// Keeps the old single amazonLink field and the new sources list agreeing,
// whichever one a client sent. Works on a plain update object (for
// findByIdAndUpdate) given the item's current values.
//   - Client sent sources (new app/website): amazonLink = first Amazon source.
//   - Client sent only amazonLink (old app): add/replace the first Amazon
//     source, leaving every other store link alone.
function syncAmazonLink(update, existing = {}) {
  const next = { ...update };
  if (Array.isArray(next.sources)) {
    const amazon = next.sources.find((s) => s && s.store === 'amazon' && s.url);
    next.amazonLink = amazon ? amazon.url : null;
    return next;
  }
  if (Object.prototype.hasOwnProperty.call(next, 'amazonLink')) {
    const link = typeof next.amazonLink === 'string' && next.amazonLink.trim() ? next.amazonLink.trim() : null;
    const current = (existing.sources || []).map((s) => (s.toObject ? s.toObject() : s));
    const idx = current.findIndex((s) => s.store === 'amazon');
    if (link && idx >= 0) current[idx] = { ...current[idx], url: link };
    else if (link) current.unshift({ store: 'amazon', url: link });
    else if (idx >= 0) current.splice(idx, 1);
    next.amazonLink = link;
    next.sources = current;
  }
  return next;
}

// Old items saved before `sources` existed only have amazonLink - fill in
// sources on read so every client sees the same thing.
itemSchema.post('init', function backfillSources(doc) {
  if ((!doc.sources || doc.sources.length === 0) && doc.amazonLink) {
    doc.sources = [{ store: 'amazon', url: doc.amazonLink }];
  }
});

const Item = mongoose.model('Item', itemSchema);
Item.STORES = STORES;
Item.syncAmazonLink = syncAmazonLink;

module.exports = Item;
