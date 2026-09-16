const mongoose = require('mongoose');

const distributionEventSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, default: Date.now },
    location: { type: String, trim: true, default: '2809 S Spring Ave, Sioux Falls, SD' },
    // Free text for whatever admins want to note after the fact -
    // total guests, weather, what ran out, anything.
    details: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    synced: { type: Boolean, default: true }, // client sets false while offline, true once pushed
  },
  { timestamps: true }
);

module.exports = mongoose.model('DistributionEvent', distributionEventSchema);
