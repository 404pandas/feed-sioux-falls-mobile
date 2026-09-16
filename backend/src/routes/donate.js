const express = require('express');
const Stripe = require('stripe');
const Donation = require('../models/Donation');
const { donateLimiter } = require('../middleware/rateLimiters');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/donate/create-payment-intent
// Public - no login required. Body: { amount, donorName?, donorEmail? }
// amount is in whole dollars (e.g. 25 for $25); we convert to cents for Stripe.
router.post('/create-payment-intent', donateLimiter, asyncHandler(async (req, res) => {
  const { amount, donorName, donorEmail } = req.body;

  if (!amount || amount < 1) {
    return res.status(400).json({ error: 'Enter a donation amount of at least $1.' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      metadata: { donorName: donorName || '', donorEmail: donorEmail || '' },
    });

    await Donation.create({
      amount,
      stripePaymentIntentId: paymentIntent.id,
      status: 'pending',
      donorName: donorName || null,
      donorEmail: donorEmail || null,
    });

    // clientSecret is what the mobile/web app needs to complete the payment.
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Could not start the donation. Please try again.' });
  }
}));

// POST /api/donate/webhook
// Called BY STRIPE, not by the app. Must receive the raw request body
// (configured in server.js) so the signature can be verified - this is
// what stops anyone from faking a "payment succeeded" call.
router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    await Donation.findOneAndUpdate(
      { stripePaymentIntentId: intent.id },
      { status: 'succeeded' }
    );
  } else if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object;
    await Donation.findOneAndUpdate(
      { stripePaymentIntentId: intent.id },
      { status: 'failed' }
    );
  }

  res.json({ received: true });
}));

module.exports = router;
