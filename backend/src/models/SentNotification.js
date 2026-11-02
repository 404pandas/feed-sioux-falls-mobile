const mongoose = require('mongoose');

// A record of every notification an admin sent from the app or website:
// what it said, who it went to, and who sent it. (Team chat messages are
// kept in StaffMessage instead.)
const sentNotificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    body: { type: String, required: true, trim: true, maxlength: 300 },
    // 'staff' = volunteers and admins only. 'everyone' = every phone with
    // that kind turned on, logged in or not.
    audience: { type: String, enum: ['staff', 'everyone'], required: true },
    kind: { type: String, enum: ['outreach', 'pantry', 'needs', 'staff'], required: true },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipients: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SentNotification', sentNotificationSchema);
