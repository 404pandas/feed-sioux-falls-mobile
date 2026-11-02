const mongoose = require('mongoose');

// One message in a MessageThread.
const threadMessageSchema = new mongoose.Schema(
  {
    thread: { type: mongoose.Schema.Types.ObjectId, ref: 'MessageThread', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

threadMessageSchema.index({ thread: 1, createdAt: -1 });

module.exports = mongoose.model('ThreadMessage', threadMessageSchema);
