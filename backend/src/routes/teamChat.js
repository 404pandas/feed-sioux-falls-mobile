const express = require('express');
const mongoose = require('mongoose');
const StaffMessage = require('../models/StaffMessage');
const { requireAuth, requireStaff } = require('../middleware/auth');
const { findRecipients, sendPush } = require('../utils/push');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Team chat: one conversation for volunteers and admins.
router.use(requireAuth, requireStaff);

const PAGE = 50;

// GET /api/team-chat?before=<ISO date> - the latest messages (oldest first),
// or the page before `before` when scrolling back.
router.get('/', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.before) {
    const before = new Date(req.query.before);
    if (Number.isNaN(before.getTime())) return res.status(400).json({ error: 'Invalid date.' });
    filter.createdAt = { $lt: before };
  }
  const messages = await StaffMessage.find(filter).sort({ createdAt: -1 }).limit(PAGE).populate('author', 'name role');
  res.json(messages.reverse());
}));

// POST /api/team-chat - Body: { body }. Everyone else on the team with
// chat notifications turned on gets a push.
router.post('/', asyncHandler(async (req, res) => {
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ error: 'Type a message first.' });
  if (body.length > 2000) return res.status(400).json({ error: 'Messages can be up to 2,000 characters.' });

  const message = await StaffMessage.create({ author: req.user._id, body });
  await message.populate('author', 'name role');
  res.status(201).json(message);

  // After answering, so a slow push service never holds up the sender.
  findRecipients({ kind: 'chat', audience: 'staff', excludeUser: req.user._id })
    .then((devices) =>
      sendPush(devices, {
        title: `${req.user.name} in team chat`,
        body: body.length > 150 ? `${body.slice(0, 147)}…` : body,
        kind: 'chat',
        data: { screen: 'TeamChat' },
      })
    )
    .catch((err) => console.error('Team chat push failed:', err.message));
}));

// DELETE /api/team-chat/:id - your own message, or any message for admins.
router.delete('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Message not found.' });
  const message = await StaffMessage.findById(req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found.' });
  if (String(message.author) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only delete your own messages.' });
  }
  await message.deleteOne();
  res.json({ success: true });
}));

module.exports = router;
