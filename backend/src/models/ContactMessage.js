const mongoose = require('mongoose');

// Every field is optional except message. This is intentional - a guest in
// crisis or in a hurry should never be blocked from reaching out because
// they didn't want to give a name or phone number.
const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
    email: { type: String, trim: true, default: null },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    category: {
      type: String,
      enum: ['suggestion', 'donate', 'partner', 'contact', 'assistance'],
      default: 'contact',
    },
    date: { type: Date, default: Date.now },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
