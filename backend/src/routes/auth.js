const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { loginLimiter } = require('../middleware/rateLimiters');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// POST /api/auth/login
// Body: { userId, pin }
// The app shows a list of volunteer names to pick from (no typing names),
// then the person enters their own PIN. This avoids needing a username field.
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { userId, pin } = req.body;

  if (!userId || !pin) {
    return res.status(400).json({ error: 'Select your name and enter your PIN.' });
  }

  const user = await User.findById(userId).catch(() => null);
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Account not found or deactivated.' });
  }

  const pinMatches = await user.comparePin(pin);
  if (!pinMatches) {
    return res.status(401).json({ error: 'Incorrect PIN.' });
  }

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });

  res.json({ token, user });
}));

// GET /api/auth/names
// Public list of active volunteer/admin names + ids, so the login screen can
// show a picker instead of a free-text username field. No PINs are exposed.
router.get('/names', asyncHandler(async (req, res) => {
  const users = await User.find({ active: true }).select('_id name role');
  res.json(users);
}));

// GET /api/auth/me
// Confirms the current token is valid and returns the logged-in user.
router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

module.exports = router;
