# Feed Sioux Falls app — Version 2

## Done in this pass

### Visual and usability bugs fixed
- **Add / Edit Item couldn't scroll.** The form sat inside a non-scrolling layout, so lower fields and Save were cut off. It now opens on its own scrolling screen.
- **Keyboard covered fields and Save buttons** on Event Details, Reports, the event start form, and donation/contact forms (iOS). Every screen now moves out of the keyboard's way.
- **"Tap Save twice."** With the keyboard open, the first tap on any button only closed the keyboard. Fixed app-wide.
- **Inventory and Stock lists were squeezed** under the search box and filters on small phones. Those now scroll with the list.
- **Today screen buttons cut off** for volunteers on small phones or with large text. It scrolls now.
- **Status bar icons invisible**: dark icons on the dark green header. Now light.
- **Stock +/− didn't work offline.** Every tap without signal showed an error, even though tally taps already queued. Stock changes now queue and sync too, with a "waiting to sync" note.
- **One bad item could jam the offline queue forever** (e.g. an item deleted while a phone was offline). Permanently rejected changes are now skipped so everything behind them still syncs.
- **PDF reports broke on "&" or "<"** in notes or item names. Text is escaped now.
- **Budget showed a broken bar** when a month had no budget set (divide by zero). Empty states added for no spending / no purchases.
- Long item names pushed the LOW label and numbers off the edge; lowercase category and role labels; Delete and −1 buttons now red text; login PIN field opens the keypad automatically and the Go key logs in; "couldn't load the volunteer list" now says so with a Try Again button.
- **Build risk:** `react-native-chart-kit ^7` requires React 19, but the app is on React 18, so a clean `npm install` failed. Pinned to 6.12.0.

### Easier navigation
Bottom tab bar for volunteers and admins:
- **Today**: people-served counter, with Adjust Stock and Survey shortcuts
- **Stock**: quick +/− inventory
- **Survey**: start, share, QR code, results (admin)
- **Admin** (admins only): Inventory, Budget, Reports, Past Events, Survey Results

### Community survey in the app
- Same questions, English/Spanish wording and backend endpoint as the website, so all answers land in one place.
- **Hand-off mode**: volunteers start it and hand the phone over; it's marked "volunteer helped". Or pick "typing in a paper survey".
- Opens full-screen without the tab bar, so the person holding the phone only sees the survey.
- **Quick Exit** in the header erases answers and leaves instantly. Back/swipe asks first, so nobody loses their place by accident.
- **Works offline**: finished surveys wait in the offline queue and send themselves. Progress saves as you go (erased after 12 hours or on send).
- Read-aloud using the phone's voice, big tap targets, 18pt text, screen-reader labels.
- Share sheet + on-phone QR code (needs `SURVEY_URL` set, see below).
- Guests (login screen and Support Us) and neighbors can take it too.

### Statistics and reports
- **Survey Results** screen (admin): totals by month, source and language; tap any question for counts and percentages; contact requests with tap-to-call and "Do NOT leave a message" warnings.
- **Report builder** has a new "Community Survey Highlights" section (on screen and in the PDF): where people slept, how long unhoused, veterans/DV survivors/etc., photo ID, service barriers, causes. Totals and percentages only.

## Setup notes
- Set `SURVEY_URL` (the website's `/survey` page) when building, or sharing/QR stays hidden: `SURVEY_URL=https://your-site/survey eas build ...`
- New packages: `@react-navigation/bottom-tabs`, `expo-speech`, `react-native-qrcode-svg`, plus `expo-constants` and `@expo/vector-icons` declared explicitly (already used). Run `npm install` in `mobile/`.
- `expo install --check` also suggests `@react-native-community/netinfo@11.3.1` and `@stripe/stripe-react-native@0.37.2` for SDK 51 (pre-existing, minor).
- Spanish lines added for the app (Quick Exit, offline, hand-back wording) are in `src/survey/languages.js`; have a native speaker check them along with the website's.
- Survey wording is copied from the website (`src/survey/strings/`). Edit both places together.

## Roadmap — next ideas

### At the table
1. **Bundles of 10** (the volunteer suggestion): load out "Socks: 12 bundles," tap "opened a bundle" during the run, count sealed bundles + loose items at the end. The app does the math and updates inventory. Two taps per bundle instead of per item.
2. **"Asked for but didn't have" tally**: one tap per request (coat size L, tent, socks) to show unmet need with real numbers.
3. **Undo last tap** for any counter, plus a big-button "field mode" (larger text, one-handed).
4. **Shift sign-up / check-in** and volunteer hours per event.

### Offline
5. Cache the item list and today's event before leaving, so the Stock tab opens with no signal.
6. A sync status icon in the header on every screen, not just Today and Stock.

### Grants and reporting
7. **Volunteer hours and in-kind donation value**: many grants count both as matching funds.
8. **Cost per person / per item** trend and **spending by category** against the budget plan.
9. **Impact one-pager** export: "In Q3 we served 2,900 people with 11,000 items for $X," ready for a grant application.
10. **CSV export** of every report section for grant portals that want spreadsheets.
11. **Unduplicated estimate**: combine tally counts with the survey's "first time / filled out before" answers to estimate unique people served, which funders ask for.
12. **Cold-weather alerts**: push a "stock winter gear" reminder when a freeze is forecast.
