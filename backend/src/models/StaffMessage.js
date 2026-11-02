const mongoose = require('mongoose');

// Team chat: one shared conversation for volunteers and admins. Only staff
// can read or post (routes/teamChat.js).
const staffMessageSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

staffMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('StaffMessage', staffMessageSchema);
