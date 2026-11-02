const mongoose = require('mongoose');

// A conversation between chosen volunteers and admins (Messages). Everyone
// in `participants` sees every message and gets a push for new ones.
// Team chat (StaffMessage) is the separate everyone-at-once conversation.
const messageThreadSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    // Sorted participant ids joined, so messaging the same people again
    // continues the same conversation instead of starting a new one.
    key: { type: String, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessage: { type: String, default: '' }, // short preview for the inbox
    lastAuthor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // When each person last opened it - anything newer is unread for them.
    readAt: { type: Map, of: Date, default: {} },
  },
  { timestamps: true }
);

messageThreadSchema.statics.keyFor = (ids) => [...new Set(ids.map(String))].sort().join(',');

module.exports = mongoose.model('MessageThread', messageThreadSchema);
