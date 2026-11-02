const rateLimit = require('express-rate-limit');

// Applied only to PUBLIC (guest) routes - contact form and donations.
// Volunteer/admin routes don't need this since they require login already.

// 5 contact form submissions per 15 minutes per IP - generous for a real
// person, restrictive enough to stop bot spam.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many messages sent. Please try again in a few minutes.' },
});

// Donation attempts - a little more generous since a real donor might retry
// a declined card a few times.
const donateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

// Community survey - higher than the contact form because shelters, the
// library, and pantry wifi put many real people behind one IP. Logged-in
// staff entering surveys for people are skipped entirely (routes/survey.js
// sets req.isStaff). express-rate-limit keeps IPs in memory only for the
// window - they're never written to the database.
const surveyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: (req) => req.isStaff === true,
  message: { error: 'Too many surveys sent from this connection. Please try again in a few minutes.' },
});

// Login attempts - protects PINs from being brute-forced.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
});

// Turning notifications on/off and changing switches - a phone does this a
// handful of times, so this only stops scripts filling the device list.
const deviceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many changes. Please try again in a few minutes.' },
});

module.exports = { contactLimiter, deviceLimiter, donateLimiter, loginLimiter, surveyLimiter };
