# Feed Sioux Falls — Backend API

Self-hosted Express + MongoDB API for the outreach app. Designed to run on
Render or Railway's free tier with MongoDB Atlas's free tier — $0/month.

## What this handles
- Volunteer/admin login (PIN-based, JWT sessions)
- Inventory tracking + low-stock detection + Amazon buy-now links
- Person-served tallies per distribution event
- Monthly budget tracking tied to purchases
- Weekly/monthly reports (for grant applications and board updates)
- Public donation flow (Stripe)
- Public contact form (no login required)

## One-time setup

### 1. Install dependencies
```
cd backend
npm install
```

### 2. Set up MongoDB Atlas (free tier)
1. Create a free account at mongodb.com/cloud/atlas
2. Create a free (M0) cluster
3. Create a database user (Database Access) and note the username/password
4. Allow access from anywhere (Network Access → 0.0.0.0/0) — fine for this scale
5. Get your connection string (Connect → Drivers) — looks like
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/feed-sioux-falls`

### 3. Set up Stripe
1. Create/log into your Stripe account
2. Dashboard → Developers → API keys → copy the **Secret key**
3. Dashboard → Developers → Webhooks → Add endpoint
   - URL: `https://<your-render-url>/api/donate/webhook` (you'll have this after step 5)
   - Events to send: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copy the **Signing secret** it gives you

### 4. Create your `.env` file
```
cp .env.example .env
```
Fill in `MONGODB_URI`, `JWT_SECRET` (generate with the command in the file),
`STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`.

### 5. Deploy to Render (or Railway — same idea)
1. Push this `backend/` folder to a GitHub repo
2. On Render: New → Web Service → connect the repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Add all the same environment variables from your `.env` file in Render's dashboard
6. Deploy — Render gives you a URL like `https://feed-sioux-falls-api.onrender.com`
7. Go back to Stripe and finish the webhook setup with that real URL

**Note:** Render's free tier "spins down" after 15 minutes of no traffic and
takes ~30-60 seconds to wake back up on the next request. For an outreach app
used a few times a week, this is a fine tradeoff for $0/month — just know the
first request of the day might be slow.

### 6. Seed initial data
```
npm run seed
```
This creates four test logins, starter inventory (from the actual bulk-buy
list), the recurring Saturday outreach events, the standing 24/7 pantry
listing, a sample person-served tally, and 5 past months of budget data:

| Name | Role | PIN |
|---|---|---|
| Dr. Lisa Coder | admin | `2809` |
| Mary Elenius | admin | `0292` |
| Volunteer (Test) | volunteer | `2800` |
| Neighbor (Test) | neighbor | `1234` |

**Change these PINs immediately** — see "Managing users" below.

## Managing users (adding/removing volunteers)

There's no admin UI for this yet — the fastest way for now is directly via
Postman/Insomnia against your deployed API, or a short script. To add a
volunteer:

```js
// example: run this as a one-off script, or add a temporary admin route
const user = new User({ name: 'Jane Doe', role: 'volunteer' });
await user.setPin('4821'); // pick any 4-6 digit PIN
await user.save();
```

To deactivate someone immediately (lost phone, etc.), set their `active`
field to `false` — their JWT will stop working on the next request.

## Local development
```
npm run dev
```
Runs on `http://localhost:4000` with auto-restart on file changes (Node's
built-in `--watch`, no nodemon needed).

## API routes reference

Three logged-in roles: **admin**, **volunteer**, and **neighbor**. "Staff"
below means admin or volunteer - neighbors can log in (see their own home
screen, donate, contact) but can't touch inventory, events, budget, or
reports; that's enforced server-side by `requireStaff`/`requireAdmin`, not
just hidden in the UI.

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/auth/login` | Public | Log in with userId + PIN |
| `GET /api/auth/names` | Public | List active user names (all roles) for login picker |
| `GET /api/items` | Staff | List inventory |
| `POST /api/items` | Admin | Add new item |
| `PATCH /api/items/:id` | Admin | Edit item details |
| `DELETE /api/items/:id` | Admin | Remove an item |
| `POST /api/items/:id/adjust-stock` | Staff | Log stock change |
| `GET /api/items/insights/forecast` | Staff | Demand forecasting |
| `POST /api/events` | Staff | Start a distribution event |
| `POST /api/events/:id/tally` | Staff | +1 person served tap |
| `PATCH /api/events/:id` | Admin | Edit event details/notes |
| `GET /api/budget/current` | Staff | This month's budget status |
| `POST /api/budget/purchases` | Staff | Log an Amazon purchase |
| `GET /api/reports/weekly` | Admin | Weekly summary |
| `GET /api/reports/monthly` | Admin | Monthly summary |
| `POST /api/donate/create-payment-intent` | Public | Start a Stripe donation |
| `POST /api/contact` | Public | Submit contact form |
| `GET /api/contact` | Admin | Review contact messages |

## A note on the Amazon "Buy Now" feature

This app does **not** log into Amazon, store Amazon credentials, or place
orders automatically. Amazon's terms of service don't allow automating
checkout on a personal account, and a locked/flagged Amazon account would be
far worse than the convenience gained. Instead, each item can have an
`amazonLink` — the mobile app opens that link in the Amazon app/browser,
pre-filled, and a person still taps "Buy" themselves. This is intentional and
should not be changed to a stored-login/auto-checkout flow.
