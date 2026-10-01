require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const eventRoutes = require('./routes/events');
const budgetRoutes = require('./routes/budget');
const reportRoutes = require('./routes/reports');
const donateRoutes = require('./routes/donate');
const contactRoutes = require('./routes/contact');
const surveyRoutes = require('./routes/survey');

const app = express();

// Render/Railway sit behind a reverse proxy - trust its X-Forwarded-For
// header so req.ip (used by express-rate-limit) reflects the real client
// instead of the proxy, and so rate limiting doesn't lump every visitor
// together under one IP.
app.set('trust proxy', 1);

// --- Security middleware (applied once, never touched again) ---
app.use(helmet());

// CORS: allow the mobile app now, and any future public web app domain you
// add to ALLOWED_ORIGINS in .env - no code change needed later.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman/Insomnia).
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  })
);

// The Stripe webhook route needs the RAW body to verify signatures, so it
// must be registered before express.json() below.
app.use('/api/donate/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(mongoSanitize());

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/donate', donateRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/survey', surveyRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Fallback error handler - keeps a stray bug from leaking a stack trace to
// guests hitting public endpoints.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Feed Sioux Falls API running on port ${PORT}`);
  });
});
