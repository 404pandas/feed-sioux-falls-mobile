const express = require('express');
const jwt = require('jsonwebtoken');
const SurveyResponse = require('../models/SurveyResponse');
const SurveyContactRequest = require('../models/SurveyContactRequest');
const User = require('../models/User');
const { surveyLimiter } = require('../middleware/rateLimiters');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { SURVEY_QUESTIONS, SURVEY_LANGUAGES, sanitizeAnswers } = require('../utils/surveyQuestions');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// The survey is public, but a logged-in volunteer/admin may be filling it
// out with someone or typing in paper forms at the pantry. Looks at the
// token if there is one - never rejects the request over it - and sets
// req.isStaff so those entries can skip the rate limit and be marked as
// volunteer-entered. The volunteer's identity is NOT saved with the
// response.
async function detectStaff(req, res, next) {
  req.isStaff = false;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);
    req.isStaff = !!user && user.active && (user.role === 'admin' || user.role === 'volunteer');
  } catch {
    // Bad/expired token - just treat them as a member of the public.
  }
  next();
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function cleanString(value, max) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

// POST /api/survey - public, no login, every question optional.
// Body: { answers, language, source, contact? }
// contact: { name, phone, email, bestTime, safeToLeaveMessage }
router.post('/', detectStaff, surveyLimiter, asyncHandler(async (req, res) => {
  const { answers: rawAnswers, language, source, contact } = req.body;

  const answers = sanitizeAnswers(rawAnswers);
  const lang = SURVEY_LANGUAGES.includes(language) ? language : 'en';

  let contactRequest = null;
  if (contact && typeof contact === 'object') {
    const phone = cleanString(contact.phone, 50);
    const email = cleanString(contact.email, 200);
    if (phone || email) {
      contactRequest = {
        name: cleanString(contact.name, 200),
        phone,
        email,
        bestTime: cleanString(contact.bestTime, 200),
        safeToLeaveMessage: typeof contact.safeToLeaveMessage === 'boolean' ? contact.safeToLeaveMessage : null,
        language: lang,
      };
    }
  }

  if (!Object.keys(answers).length && !contactRequest) {
    return res.status(400).json({ error: 'Please answer at least one question.' });
  }

  if (Object.keys(answers).length) {
    await SurveyResponse.create({
      answers,
      language: lang,
      // Only staff can mark an entry as volunteer-assisted or paper.
      source: req.isStaff && (source === 'volunteer' || source === 'paper') ? source : 'self',
      submittedOn: startOfUtcDay(new Date()),
    });
  }

  if (contactRequest) {
    await SurveyContactRequest.create(contactRequest);
  }

  // No id in the response - nothing for the device to hold on to.
  res.status(201).json({ success: true });
}));

// --- Admin only below ---

function dateFilter(query) {
  const filter = {};
  if (query.start) filter.$gte = startOfUtcDay(new Date(query.start));
  if (query.end) filter.$lte = startOfUtcDay(new Date(query.end));
  return Object.keys(filter).length ? { submittedOn: filter } : {};
}

// GET /api/survey/summary?start=&end= - totals and per-answer counts only,
// never individual responses. This is what gets shared with City Council
// (council materials can become public records, so summaries only).
router.get('/summary', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const responses = await SurveyResponse.find(dateFilter(req.query), { answers: 1, submittedOn: 1, source: 1, language: 1 })
    .sort({ submittedOn: 1 })
    .lean();

  const questions = {};
  for (const q of SURVEY_QUESTIONS) {
    if (q.type === 'text') {
      questions[q.id] = { type: q.type, answered: 0 };
    } else {
      questions[q.id] = { type: q.type, answered: 0, counts: {} };
    }
  }

  const byMonth = new Map(); // 'YYYY-MM' -> count, in date order
  const bySource = { self: 0, volunteer: 0, paper: 0 };
  const byLanguage = {};

  for (const r of responses) {
    const month = r.submittedOn.toISOString().slice(0, 7);
    byMonth.set(month, (byMonth.get(month) || 0) + 1);
    bySource[r.source] = (bySource[r.source] || 0) + 1;
    byLanguage[r.language] = (byLanguage[r.language] || 0) + 1;

    for (const q of SURVEY_QUESTIONS) {
      const value = r.answers?.[q.id];
      if (value === undefined) continue;
      const summary = questions[q.id];
      summary.answered += 1;
      if (q.type === 'text') continue;
      for (const code of Array.isArray(value) ? value : [value]) {
        summary.counts[code] = (summary.counts[code] || 0) + 1;
      }
    }
  }

  res.json({
    total: responses.length,
    byMonth: [...byMonth].map(([month, count]) => ({ month, count })),
    bySource,
    byLanguage,
    questions,
  });
}));

// GET /api/survey/comments?start=&end= - the written answers, for Feed
// Sioux Falls to read and pick quotes from. Returned shuffled and with only
// the month, so they can't be lined up with each other or with a date.
// Review before sharing anything - people sometimes write identifying
// details.
router.get('/comments', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const responses = await SurveyResponse.find(
    { ...dateFilter(req.query), $or: [{ 'answers.services_missing': { $exists: true } }, { 'answers.council_message': { $exists: true } }] },
    { answers: 1, submittedOn: 1, language: 1 }
  ).lean();

  const comments = [];
  for (const r of responses) {
    const month = r.submittedOn.toISOString().slice(0, 7);
    for (const field of ['services_missing', 'council_message']) {
      if (r.answers[field]) comments.push({ question: field, text: r.answers[field], month, language: r.language });
    }
  }
  for (let i = comments.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [comments[i], comments[j]] = [comments[j], comments[i]];
  }
  res.json(comments);
}));

// GET /api/survey/contact-requests - people who asked to be contacted.
router.get('/contact-requests', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const filter = req.query.includeResolved === 'true' ? {} : { resolved: false };
  const requests = await SurveyContactRequest.find(filter).sort({ createdAt: -1 });
  res.json(requests);
}));

// PATCH /api/survey/contact-requests/:id/resolve - admin marks one handled.
router.patch('/contact-requests/:id/resolve', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const request = await SurveyContactRequest.findByIdAndUpdate(
    req.params.id,
    { resolved: true },
    { new: true, runValidators: true }
  );
  if (!request) return res.status(404).json({ error: 'Contact request not found.' });
  res.json(request);
}));

module.exports = router;
