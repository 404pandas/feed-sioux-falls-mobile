const express = require('express');
const ContactMessage = require('../models/ContactMessage');
const { contactLimiter } = require('../middleware/rateLimiters');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// POST /api/contact - public, no login. Only `message` is required.
router.post('/', contactLimiter, asyncHandler(async (req, res) => {
  const { name, phone, email, message, category } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Please include a message.' });
  }

  const contactMessage = await ContactMessage.create({
    name: name || null,
    phone: phone || null,
    email: email || null,
    message: message.trim(),
    category: category || 'contact',
  });

  res.status(201).json({ success: true, id: contactMessage._id });
}));

// GET /api/contact - admin only, to review submitted messages
router.get('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const messages = await ContactMessage.find().sort({ date: -1 });
  res.json(messages);
}));

// PATCH /api/contact/:id/resolve - admin marks a message as handled
router.patch('/:id/resolve', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const message = await ContactMessage.findByIdAndUpdate(
    req.params.id,
    { resolved: true },
    { new: true, runValidators: true }
  );
  if (!message) return res.status(404).json({ error: 'Message not found.' });
  res.json(message);
}));

module.exports = router;
