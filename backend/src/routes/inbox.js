const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const MessageThread = require('../models/MessageThread');
const ThreadMessage = require('../models/ThreadMessage');
const PushDevice = require('../models/PushDevice');
const { requireAuth, requireStaff } = require('../middleware/auth');
const { sendPush } = require('../utils/push');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Messages: volunteers and admins write to people they choose (all
// volunteers, all admins, minus anyone they untick). Everyone in the
// conversation sees replies and gets a push for each new message (if
// "Team chat & messages" notifications are on).
router.use(requireAuth, requireStaff);

const PAGE = 100;

function preview(body) {
  return body.length > 120 ? `${body.slice(0, 117)}…` : body;
}

function isParticipant(thread, userId) {
  return thread.participants.some((p) => String(p._id || p) === String(userId));
}

function unreadFor(thread, userId) {
  const read = thread.readAt?.get(String(userId));
  return String(thread.lastAuthor) !== String(userId) && (!read || read < thread.lastMessageAt);
}

function summary(thread, userId) {
  return {
    _id: thread._id,
    participants: thread.participants.map((p) => ({ _id: p._id, name: p.name, role: p.role })),
    lastMessage: thread.lastMessage,
    lastMessageAt: thread.lastMessageAt,
    unread: unreadFor(thread, userId),
  };
}

// Push to everyone in the conversation except the sender. After the
// response, so a slow push service never holds up sending.
function notify(thread, sender, body) {
  const others = thread.participants.map((p) => p._id || p).filter((id) => String(id) !== String(sender._id));
  const group = others.length > 1 ? ` (+${others.length - 1})` : '';
  PushDevice.find({ user: { $in: others }, 'prefs.chat': true })
    .populate('user', 'role active')
    .then((devices) =>
      sendPush(
        devices.filter((d) => d.user?.active),
        { title: `${sender.name}${group}`, body: preview(body), kind: 'chat', data: { screen: 'Thread', threadId: String(thread._id) } }
      )
    )
    .catch((err) => console.error('Message push failed:', err.message));
}

async function addMessage(thread, user, body) {
  const message = await ThreadMessage.create({ thread: thread._id, author: user._id, body });
  thread.lastMessageAt = message.createdAt;
  thread.lastMessage = preview(body);
  thread.lastAuthor = user._id;
  thread.readAt.set(String(user._id), message.createdAt);
  await thread.save();
  await message.populate('author', 'name role');
  return message;
}

function readBody(req) {
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body) return { error: 'Type a message first.' };
  if (body.length > 2000) return { error: 'Messages can be up to 2,000 characters.' };
  return { body };
}

// GET /api/inbox/people - who you can message: every active volunteer and
// admin except you.
router.get('/people', asyncHandler(async (req, res) => {
  const people = await User.find({ active: true, role: { $in: ['admin', 'volunteer'] }, _id: { $ne: req.user._id } })
    .select('_id name role')
    .sort({ role: 1, name: 1 });
  res.json(people);
}));

// GET /api/inbox - your conversations, newest first.
router.get('/', asyncHandler(async (req, res) => {
  const threads = await MessageThread.find({ participants: req.user._id })
    .sort({ lastMessageAt: -1 })
    .limit(100)
    .populate('participants', 'name role');
  res.json(threads.map((t) => summary(t, req.user._id)));
}));

// GET /api/inbox/unread - how many conversations have something new.
router.get('/unread', asyncHandler(async (req, res) => {
  const threads = await MessageThread.find({ participants: req.user._id }).select('lastMessageAt lastAuthor readAt');
  res.json({ count: threads.filter((t) => unreadFor(t, req.user._id)).length });
}));

// POST /api/inbox - Body: { recipientIds: [...], body }. Starts a
// conversation (or continues the one with exactly these people).
router.post('/', asyncHandler(async (req, res) => {
  const { body, error } = readBody(req);
  if (error) return res.status(400).json({ error });
  const ids = (Array.isArray(req.body.recipientIds) ? req.body.recipientIds : []).filter((id) => mongoose.isValidObjectId(id));
  const recipients = await User.find({ _id: { $in: ids, $ne: req.user._id }, active: true, role: { $in: ['admin', 'volunteer'] } }).select('_id');
  if (!recipients.length) return res.status(400).json({ error: 'Choose at least one person to message.' });

  const participantIds = [req.user._id, ...recipients.map((r) => r._id)];
  const key = MessageThread.keyFor(participantIds);
  let thread = await MessageThread.findOne({ key });
  if (!thread) thread = await MessageThread.create({ participants: participantIds, key, createdBy: req.user._id });

  const message = await addMessage(thread, req.user, body);
  await thread.populate('participants', 'name role');
  res.status(201).json({ thread: summary(thread, req.user._id), message });
  notify(thread, req.user, body);
}));

async function findThread(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Conversation not found.' });
    return null;
  }
  const thread = await MessageThread.findById(req.params.id).populate('participants', 'name role');
  if (!thread || !isParticipant(thread, req.user._id)) {
    res.status(404).json({ error: 'Conversation not found.' });
    return null;
  }
  return thread;
}

// GET /api/inbox/:id - the conversation and its latest messages (oldest
// first). Opening it marks it read.
router.get('/:id', asyncHandler(async (req, res) => {
  const thread = await findThread(req, res);
  if (!thread) return;
  const messages = await ThreadMessage.find({ thread: thread._id }).sort({ createdAt: -1 }).limit(PAGE).populate('author', 'name role');
  thread.readAt.set(String(req.user._id), new Date());
  await thread.save();
  res.json({ thread: summary(thread, req.user._id), messages: messages.reverse() });
}));

// POST /api/inbox/:id - reply. Body: { body }
router.post('/:id', asyncHandler(async (req, res) => {
  const { body, error } = readBody(req);
  if (error) return res.status(400).json({ error });
  const thread = await findThread(req, res);
  if (!thread) return;
  const message = await addMessage(thread, req.user, body);
  res.status(201).json(message);
  notify(thread, req.user, body);
}));

module.exports = router;
