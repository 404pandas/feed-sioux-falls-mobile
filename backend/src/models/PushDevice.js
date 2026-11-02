const mongoose = require('mongoose');

// The kinds of notifications the app can get. Each one has its own on/off
// switch in the app's Notifications screen (and its own Android channel).
//   outreach - Saturday outreach reminders and changes (e.g. weather)
//   pantry   - pantry news ("the pantry was just restocked")
//   needs    - "we need..." asks for supplies
//   staff    - notices from admins to volunteers (staff only)
//   chat     - new team chat messages (staff only)
const KINDS = ['outreach', 'pantry', 'needs', 'staff', 'chat'];
const STAFF_ONLY_KINDS = ['staff', 'chat'];

// One row per phone that turned notifications on. No login is needed for the
// public kinds; when someone is logged in, `user` ties the phone to them so
// staff notices and team chat reach them. Logging out sets `user` back to
// null. Holds no names or answers - just the push address and switches.
const pushDeviceSchema = new mongoose.Schema(
  {
    // Expo push token, e.g. "ExponentPushToken[xxxx]".
    token: { type: String, required: true, unique: true, trim: true, maxlength: 200 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    platform: { type: String, enum: ['android', 'ios', 'other'], default: 'android' },
    prefs: {
      outreach: { type: Boolean, default: true },
      pantry: { type: Boolean, default: true },
      needs: { type: Boolean, default: true },
      staff: { type: Boolean, default: true },
      chat: { type: Boolean, default: true },
    },
    // "Hide what notifications say": the phone only ever gets "You have a
    // new update", and it's kept off the lock screen.
    hideContent: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const PushDevice = mongoose.model('PushDevice', pushDeviceSchema);
PushDevice.KINDS = KINDS;
PushDevice.STAFF_ONLY_KINDS = STAFF_ONLY_KINDS;

module.exports = PushDevice;
