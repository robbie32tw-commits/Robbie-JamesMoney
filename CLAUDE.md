# CLAUDE.md — 記帳阿邦 (Abang Expense Tracker)

## Project Overview

A couples expense-tracking PWA called "記帳阿邦" (Abang Accountant). Two users (payer A and B) log daily expenses with categories, budgets, and statistics. The app is a vanilla HTML/CSS/JS frontend — no build step, no bundler, no framework. Data syncs in real-time via Firebase Firestore with localStorage as a fallback.

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no frameworks, no bundler)
- **Backend**: Firebase Firestore (real-time sync via `onSnapshot`)
- **Auth**: Firebase Anonymous Authentication
- **Hosting**: Firebase Hosting (project: `rjmoney-75aa1`)
- **PWA**: Service worker (`sw.js`) with network-first caching strategy
- **Language**: UI is entirely in Traditional Chinese (繁體中文)

## File Structure

```
├── index.html        # Main mobile PWA (single page with 4 views)
├── app.js            # All application logic (~1340 lines)
├── style.css         # All styles including dark/light theme (~1425 lines)
├── viewer.html       # Standalone desktop viewer (read-only, self-contained)
├── sw.js             # Service worker (network-first caching)
├── manifest.json     # PWA manifest ("記帳阿邦")
├── firebase.json     # Firebase Hosting config (no-cache headers)
├── .firebaserc       # Firebase project binding
├── 404.html          # Firebase default 404 page
├── assets/           # PWA icons (icon-180/192/512.png, abang_character.png)
├── abang_character.png  # Mascot image (also in assets/)
├── .claude/launch.json  # Dev server config (python3 http.server :5173)
└── .agents/workflows/deploy.md  # Deployment instructions
```

## Architecture

### Single-Page App Structure (index.html)

The app has 4 views, switched via bottom navigation bar:
1. **首頁 (Dashboard)** — greeting, meal tracker, inline expense form, 7-day bar chart
2. **紀錄 (Records)** — scrollable list of past expenses with edit/delete
3. **統計 (Stats)** — budget progress bars, pie charts, monthly bar chart, top-5 expenses, daily table
4. **設定 (Settings)** — daily budget, payer names, theme toggle, import/export, clear data

### Data Model

Firestore path: `abang_data/sharedAccount/expenses/{id}`

Each expense document:
```js
{ amount: Number, category: String, payer: "A"|"B", date: ISO string, detail: String }
```

Settings stored in `abang_data/sharedAccount`:
```js
{ dailyBudget: Number, payerAName: String, payerBName: String, theme: "light"|"dark" }
```

### Expense Categories

| ID | Name | Icon |
|---|---|---|
| `breakfast` | 早餐 | 🍳 |
| `lunch` | 午餐 | 🍱 |
| `dinner` | 晚餐宵夜 | 🍜 |
| `drinks` | 飲料/點心 | 🧋 |
| `others` | 其他 | ✨ |

Legacy categories (`brunch`, `alcohol`) are auto-migrated on read.

### Key Functions in app.js

- `init()` — entry point, runs on DOMContentLoaded
- `loadStateFromFirebase()` — sets up Firestore real-time listeners, handles legacy data migration
- `saveState()` — writes settings to Firestore + localStorage backup
- `setupNumpad()` — calculator-style input with +/- operators
- `updateDashboard()` — refreshes budget bars, greeting, 7-day chart
- `renderRecords()` — builds the records list
- `initStatsView()` / `renderStatsForMonth()` — statistics page rendering
- `renderMealTracker()` — per-day meal breakdown showing both payers
- `update7DayBarChart()` — recent spending bar chart
- `updatePieChart()` / `updateStatsPieChart()` — category pie charts (pure CSS conic-gradient)
- `setupSettings()` — settings page event handlers, export/import

### viewer.html

Self-contained desktop-oriented read-only viewer. Has its own Firebase config and styles (not shared with the mobile app). Connects to the same Firestore collection.

## Development

### Running locally

```bash
python3 -m http.server 5173
```

Then open `http://localhost:5173`. No build step needed — edit files and refresh.

### Deployment

**Always** deploy with a descriptive message:
```bash
firebase deploy --only hosting -m "描述這次部署的變更"
```

**Never** run bare `firebase deploy` without the `-m` flag. See `.agents/workflows/deploy.md` for full deploy protocol.

### Service Worker

After changing `app.js`, `style.css`, or `index.html`, bump the cache version in `sw.js` (`CACHE_NAME = 'abang-cache-vN'`) and the cache-bust query params in `index.html` (`app.js?v=...`, `style.css?v=...`).

## Conventions

- All UI text must be in Traditional Chinese (繁體中文)
- Commit messages should be in Traditional Chinese
- The mascot "阿邦" is a rabbit accountant character — keep the playful tone in UI messages
- Currency is always NT$ (New Taiwan Dollar), integer amounts only
- Dates use local timezone via `new Date()`, stored as ISO strings
- Charts are rendered with pure CSS (conic-gradient for pie, flexbox for bars) — no chart libraries
- The app uses Firebase SDK v8 (compat mode) loaded via CDN script tags
- No npm/node dependencies — everything is loaded via CDN or written inline
