# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Each Day — Remembered" is a personal daily journal web app. Each "day page" combines Google Calendar events, weather, a chosen news headline, and timestamped notes into a permanent snapshot. The calendar view is the primary navigation.

## Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS v4 (no routing library — state-driven navigation)
- **Backend**: Express 5 (port 3001, ESM)
- **Database**: Supabase (PostgreSQL) — server-side only, never exposed to the frontend
- **Auth**: Google OAuth 2.0 (manual implementation — no library dependency)
- **Weather**: Open-Meteo (free, no API key — forecast + archive APIs)
- **News**: RSS feeds — AP News, NPR, The Guardian (no API key)

## Commands

```bash
npm run dev          # start both servers (Vite on :5173, Express on :3001)
npm run dev:client   # Vite only
npm run dev:server   # Express only (nodemon)
npm run build        # production build → dist/
npm run lint         # ESLint
```

## Environment Setup

Before running, fill in `.env` at the project root:

1. **Supabase**: Get `SUPABASE_SERVICE_KEY` from Supabase dashboard → Settings → API → service_role key
2. **Google**: In [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → create an OAuth 2.0 Client ID (Web application). Set redirect URI to `http://localhost:5173/api/auth/callback`. Enable the **Google Calendar API** in the library. Copy client ID and secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
3. **Database**: Run `supabase/schema.sql` in the Supabase SQL editor once to create all tables.
4. **SESSION_SECRET**: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Architecture

```
Frontend (Vite :5173)
  └─ /api/* → proxied to Express :3001
       ├─ /api/auth    — Google OAuth, session management
       ├─ /api/calendar — Google Calendar API events (cached in journal_events)
       ├─ /api/weather  — Open-Meteo (cached in weather_snapshots)
       ├─ /api/news     — RSS feeds (cached in news_headlines)
       ├─ /api/journal  — CRUD for notes, headlines, quotes; list/search
       └─ /api/settings — user location, preferences
```

### Key design patterns

**Caching strategy**: Weather, events, and news headlines are fetched on first page view and stored permanently in Supabase. Past-day data doesn't change. `journal_days` is the anchor row — all other tables reference it.

**Auth flow**: Google OAuth callback creates/updates a `users` row (keyed by `google_id`) and stores access+refresh tokens in `calendar_accounts`. Sessions are HTTP-only cookies via `express-session`. All authenticated routes use `req.session.userId`.

**Token refresh**: `server/lib/graph.js → getValidAccessToken()` checks expiry with a 5-minute buffer and refreshes via raw HTTP POST to `https://oauth2.googleapis.com/token`. Google only issues a new refresh token on the first consent; subsequent refreshes only return a new access token.

**Navigation**: `App.jsx` holds `view` state (`'calendar'` | `'day'`) and `selectedDate`. No router — just conditional rendering.

**Data loading**: `useJournalDay(date)` fires all 5 fetches in parallel on mount. Each section (events, weather, news, notes, quote) updates independently so partial failures don't block the page.

### File structure

```
server/
  index.js              — Express entry, session, CORS, route mounts
  lib/
    supabase.js         — Supabase service-role client
    graph.js            — Microsoft Graph helpers (token refresh + calendar fetch)
    weather.js          — Open-Meteo fetch + WMO code mapping
    news.js             — RSS feed fetching via rss-parser
  middleware/
    requireAuth.js      — session guard
  routes/
    auth.js             — /connect, /callback, /me, /logout, /disconnect
    calendar.js         — /events (cache-first), /events/refresh
    weather.js          — / (cache-first)
    news.js             — / (cache-first)
    journal.js          — /list, /search, /:date (summary + CRUD)
    settings.js         — /, /geocode, /location

src/
  App.jsx               — shell: auth gate, top bar, view routing, overlays
  lib/
    api.js              — typed fetch wrapper for all /api endpoints
    dates.js            — date-fns re-exports + formatting helpers
    weatherCodes.js     — WMO code → emoji/label mapping
  hooks/
    useAuth.js          — user + calendarConnected state
    useJournalDay.js    — all day-page data + mutators (notes, headline, quote)
    useVoice.js         — Web Speech API wrapper
    useCalendarDays.js  — month-level entry indicators for calendar dots
  components/
    CalendarView.jsx    — monthly grid with entry-dot indicators
    DayPage.jsx         — day view; composes all section components
    EventTimeline.jsx   — all-day pills + timed vertical timeline
    WeatherCard.jsx     — temperature, condition, precip, wind, UV
    NewsSection.jsx     — 3-card headline chooser with selection state
    NotesSection.jsx    — add/edit/delete/pin notes; voice recording
    QuoteSection.jsx    — optional daily quote with inline edit
    SearchBar.jsx       — full-screen overlay, debounced, date-range filter
    Settings.jsx        — location search, Outlook connect/disconnect, prefs
    ui/
      Skeleton.jsx      — Skeleton + SkeletonBlock components
      EmptyState.jsx    — icon/title/description/action layout

supabase/
  schema.sql            — full schema; run once in Supabase SQL editor
```

### Database schema (summary)

| Table | Purpose |
|---|---|
| `users` | Profile, location (lat/lng), timezone, temperature unit; keyed by `google_id` |
| `calendar_accounts` | Google access+refresh tokens |
| `journal_days` | Anchor row per (user, date) |
| `journal_events` | Snapshot of Outlook events for the day |
| `weather_snapshots` | Daily weather cached from Open-Meteo |
| `news_headlines` | Top 3 RSS headlines cached on first view |
| `selected_headlines` | The one headline the user pinned |
| `journal_notes` | Timestamped text/voice notes; pinnable |
| `quotes` | Optional daily quote |
| `tags` / `note_tags` | Tag system (schema ready, UI not yet built) |
| `attachments` | Future media support (schema only) |

## Adding features

- **Mood tracking**: Add a `mood` column to `journal_days` and a mood picker in `DayPage`
- **Photos**: Use Supabase Storage; add rows to `attachments`; surface in `NotesSection`
- **Location check-ins**: Add `check_ins` table with lat/lng + name; show in DayPage header
- **Tags on notes**: `tags` and `note_tags` tables already exist; wire up tag picker in `NotesSection`
