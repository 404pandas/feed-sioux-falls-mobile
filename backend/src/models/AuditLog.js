const mongoose = require('mongoose');

// One row per change an admin makes through the Data screens (create,
// edit, delete). Lets Feed Sioux Falls answer "who changed this, and when"
// for sensitive records. Stores which fields changed, never their values,
// so the log itself doesn't become another copy of private data.
const auditLogSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, enum: ['create', 'update', 'delete'], required: true },
  collectionKey: { type: String, required: true },
  docId: { type: String, required: true },
  fields: { type: [String], default: [] },
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
