# Feed Sioux Falls app — Version 3.0.0

Status: **built** on the `v3-ota-notifications-team-chat` branch (backend + mobile). Not deployed yet. See
"Setup needed" and "Rollout order" below.

## Built in 3.0.0

### 1. Updates without reinstalling (EAS Update)
- Changes to screens, wording, and logic reach phones without a new APK: `npm run update --prefix mobile`
  (runs `eas update --channel preview`).
- The app checks for an update when it opens and when it comes back to the front (at most every 15 minutes),
  downloads it in the background, and shows **"A new version is ready. Restart now / Later"**.
- The login screen shows the version, plus "updated Nov 2" once an update is running.
- `runtimeVersion` in `mobile/app.config.js` is `"3"`. Leave it alone for JS-only changes. Bump it **only**
  when a native module is added or upgraded. That build needs a new APK installed by hand, and the bump stops
  old APKs from getting code they can't run.
- **Version 3.0.0 itself must be installed by hand once.**

### 2. Notifications, with a switch for each kind
- Settings → **Notifications** (More tab for staff, "Notifications" link in the public footer, and "Remind me
  on Saturdays" on the home screen).
- One main switch plus a switch per kind: Outreach reminders, Pantry news, "We need…" requests, and, for staff
  only, Notices from admins and Team chat.
- Off until someone turns it on. Volunteers and admins are asked once, right after logging in.
- Each kind is its own Android channel, so it also shows up in the phone's notification settings.
- The Saturday reminder (8 am, "Outreach today, 10–11 am") is scheduled on the phone itself. It works with no
  signal and without Firebase. Android can delay a scheduled notification by up to an hour, which is why it's
  8 and not 9.
- Tapping a notification opens the matching screen (team chat, staff home, Get help, Give).

### 3. Privacy mode
- **"Hide what notifications say"**: the phone only ever gets "You have a new update", on channels that are
  never shown on the lock screen. The server swaps the wording itself, so the real text never reaches the
  phone.
- The screen says plainly that Android always shows which app a notification came from.
- The send screen reminds admins to keep public notices neutral.

### 4. Admins send notifications
- Staff home → **Send a notice** (or More → Send a notification). Choose **Volunteers & admins** or **Everyone**
  (then outreach, pantry, or "we need…"). Write it, see a preview and how many phones it reaches, then confirm
  ("Send to 12 phones?").
- Every send is kept in **Sent Notifications** and the **Change Log** with the sender's name. Both are on the
  website under All data → Team.

### 5. Team chat (volunteers ↔ admins)
- Staff home → **Team chat**. One conversation for every volunteer and admin, with names and roles.
- New messages appear every few seconds while it's open, and as a notification otherwise (for anyone with
  "Team chat" switched on). The home tile shows "3 new messages".
- Press and hold to delete your own message. Admins can delete any message, here or on the website.

### 6. Receipts and the budget (app and website)
- **Add a receipt** (any volunteer or admin): take or choose a photo, or type it in. On the phone, Google ML
  Kit reads the photo's text offline (no AI service, no cost, nothing sent anywhere). Plain rules then fill in
  the store, date, and total, and suggest inventory items with quantities ("+ Cotton crew socks ×12, from
  'CREW SOCKS 12PK'"). Everything is editable before saving. The website is manual entry plus an optional photo
  upload.
- Items added to a receipt go into stock once, when it's saved, and show in the inventory history as restocks.
- The photo is saved at about 1600px (roughly 300 KB) so the paper can be thrown away. The free database tier
  holds about 1,500. Admins see the space used on the Budget page.
- **Budget, one month at a time:** admins change the month's total; spending by category; receipts plus older
  single-item purchases. Reports and charts count receipts too.
- **Admins** can edit or delete any receipt (deleting doesn't undo stock) and, for the bookkeeper:
  - **Download for QuickBooks** on each photo, named `2026-10-30 Walmart 57.29.jpg` (on the phone, the share
    sheet: email, Drive, or the QuickBooks app).
  - **Export month (CSV):** Date, Payee, Amount, Category, Memo, Receipt photo file name, Added by. Amounts are
    positive; QuickBooks' bank-import screen lets you pick that.

### 7. Store links for reordering (app)
- Edit items has the website's store-link editor: any number of stores (Amazon, Temu, Dollar General,
  Walmart, Target, Costco, Sam's Club, other), each with a link and an optional price and pack size, with the
  cheapest per unit marked.
- Item cards show **Reorder** buttons for every store (cheapest highlighted). On the volunteer Inventory tab
  they show when an item is low.

### 8. People & logins (app)
- More → People & logins (admins): add admins, volunteers, and neighbors; change roles; reset PINs; turn off
  "Can log in"; delete. The website's People & logins page does the same.
- Every change applies on that person's next tap. **A new PIN now logs that person out on every phone and
  computer** (it didn't before; logins last 30 days). Guards: there's always at least one active admin, and
  nobody can turn off or delete themselves.

### Fixes from the audit (Oct 29)
- Opening the app with no signal no longer drops staff to the public screens.
- Requests time out after 20 seconds instead of spinning forever.
- An expired login (they last 30 days) now says "Please log in again" instead of quietly failing. The offline
  queue waits and sends after logging back in.
- Editing an item no longer overwrites its stock count. Stock is changed with −/+ so it's kept in the history.
- Add/Edit item category buttons no longer break words ("Hygie / ne").
- Stripe and netinfo pinned to the versions Expo SDK 51 expects.

## Not in 3.0.0 (still planned)
- "Report the pantry" (fridge empty, needs cleaning…).
- Inventory "Ask for this" button that pre-fills a "We need…" notice.
- Full offline Inventory (item list cached for a cold start with no signal) and a sync icon on every screen.
- Hide an item from the public list, from the app (the website has it).
- Crash reporting (Sentry).
- Freeze warnings.
- Sending notifications from the website (admins send from the app for now).
- Volunteer shift sign-up and hours.

## Setup needed (one time, before building 3.0.0)
1. **Firebase (free), for push on Android.** In the Firebase console, create a project and add an Android app
   with package `com.feedsiouxfalls.app`. Download `google-services.json` and either put it in `mobile/`, or
   upload it to EAS as a file environment variable named `GOOGLE_SERVICES_JSON`
   (`eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json`). Then upload a
   Firebase service account key to Expo for FCM v1 (`eas credentials` → Android → Push Notifications).
   Without this the app still works, but only the on-phone Saturday reminder fires.
2. **Stripe key in EAS.** `mobile/.env` is git-ignored, so EAS builds don't see it. Set it with
   `eas env:create --name STRIPE_PUBLISHABLE_KEY --value pk_...`, or card donations in the app won't work.
3. EAS Update is already configured (`updates.url` and the `preview` channel). The first `eas update` may ask
   to link the project. Say yes.

## Rollout order
1. Deploy the backend (new routes: `/api/notifications`, `/api/team-chat`). Old app versions are unaffected.
2. Deploy the website branch `v3-team-chat-data` (Team group in All data; Receipts & budget page for all staff).
3. Build the 3.0.0 APK (`npm run build:android --prefix mobile`) and install it by hand on every phone. This is
   the last required reinstall.
4. From then on, ship app changes with `npm run update --prefix mobile`. Only build a new APK (and bump
   `runtimeVersion`) when a native module is added.

## Google Play (audit, Nov 2)

### Done in the app
- **Expo SDK 54** (React Native 0.81): targets **Android 16 / API 36**, which Play has required for new apps
  and updates since Aug 31, 2026. `npm run build:play --prefix mobile` builds the Android App Bundle (AAB) Play
  takes; `npm run build:android` still makes an APK for hand installs. Both use the `production` update channel.
- **Keyboard:** Android 15+ draws apps edge to edge and no longer shrinks the screen for the keyboard, which hid
  Save/Send buttons under it. Every screen now keeps the field being typed in, and the buttons under it,
  reachable above the keyboard (`react-native-keyboard-controller`, in `components/Screen`).
- **Large text:** line heights now grow with the phone's text size (lines were overlapping and cut off at
  200%); the header and tab bar grow less than the rest so they stay on one line; home tiles and survey
  language buttons go one per row at very large sizes; buttons that split words ("Mont / h") wrap instead.
- **Screen readers:** every text field has a spoken label (35 didn't), on the website too (16 didn't).
- **Photos:** receipts use Android's photo picker, which needs no permission. The "read all photos"
  permissions Play restricts are blocked from the build.
- **Card donations:** the in-app card form only appears with a live Stripe key (`pk_live_…`). Zeffy, text, and
  Pledge links always show. Play allows outside payment for donations to tax-exempt nonprofits (501(c)(3)).

### Before submitting (needs you)
1. **Change production PINs.** The seed file's PINs (in this repo) log in to the live server, at least for
   Mary Elenius. Reset every admin's PIN from People & logins, and delete or turn off "Volunteer (Test)" and
   "Neighbor (Test)". A new PIN logs that person out everywhere.
2. Firebase `google-services.json` + FCM key (see "Setup needed"). Without it, Play reviewers can't get
   pushes, but the app still works.
3. Stripe **live** key as an EAS environment variable (`STRIPE_PUBLISHABLE_KEY`, Production + Preview) if you want card
   donations in the app. `npm run update` uses those EAS values (`--environment production`), never your local
   `.env`, so an update can't push the test key to phones.
4. Play Console: a **privacy policy URL** (the app collects survey answers, contact details for follow-up,
   receipt photos, and push tokens), the **Data safety** form to match, content rating, and target audience.
5. Personal developer accounts made after Nov 2023 must run a **closed test with 12+ testers for 14 days**
   before production. An organization account (needs a free D-U-N-S number) skips that.
6. Store listing: 512×512 icon, 1024×500 feature graphic, and phone screenshots.

### Local testing gotcha
`mobile/.env` sets `API_URL` to the **live** server. A local native build made without `API_URL` set in the
shell points at production. Always build with `API_URL=http://10.0.2.2:4000` (emulator) for testing.
