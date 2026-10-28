# Personal Time Tracker: SPEC

## 1. Purpose
A single-user web app to track how my time is spent and how much of it is productive vs wasted. Mobile-first (mostly used on a phone), also works on desktop.

## 2. Tech stack (fixed, do not change or suggest alternatives)
- React + Vite + TypeScript
- Tailwind CSS
- Zustand with `persist` middleware (localStorage)
- Chart.js with react-chartjs-2 (doughnut/pie + stacked bar)
- date-fns for all date math
- Vitest for unit tests
- vite-plugin-pwa (Stage 5 only)
- Deployed to Vercel as a static site

Do NOT use: Next.js, any backend, database, auth, API route or server code.

## 3. Architecture rules
1. All persistence goes through `src/storage/`, implemented as a custom storage adapter passed to Zustand `persist`. Components never touch localStorage directly. This must be swappable later (IndexedDB / remote backend) by changing one place.
2. All time/date calculations live in `src/lib/time.ts` as pure functions. No React, and no `Date.now()` inside them: pass `now` as a parameter. Cover them with Vitest tests.
3. Components only render and dispatch store actions. No calculation logic inside components.
4. Suggested folders: `src/storage`, `src/store`, `src/lib`, `src/components`, `src/pages`.

## 4. Data model
All timestamps are epoch milliseconds (number). Local timezone is used only when grouping by day/week/month/year. Weeks start on Monday (keep as one constant).

- Category: `{ id: string, name: string, color: string (hex), type: 'productive' | 'wasted' | 'neutral', archived: boolean, dailyGoalMinutes?: number }`
- Entry: `{ id: string, categoryId: string, start: number, end: number, note?: string }` with end > start
- ActiveTimer: `{ categoryId: string, startedAt: number, goalMinutes?: number } | null`
- Other state: `previousCategoryId: string | null` (for Resume), `lastExportedAt: number | null`, `schemaVersion: 1`

Entries store `categoryId` ONLY, never the category name or color.

Default categories on first launch: Work (productive), Study (productive), Social Media (wasted), Games (wasted), Break (neutral).

## 5. Core rules
1. **Timestamp-based timing.** Elapsed = `now - startedAt`. NEVER count seconds with an incrementing counter. `setInterval` (1s) is used only to trigger a re-render, and also re-render on `visibilitychange`. The timer must stay correct after refresh, tab close, or phone lock. Guard against negative values (if now < startedAt, elapsed = 0).
2. **Single timer.** Only one active timer at a time. Tapping a different category while one runs: stop the current one, save an Entry (start = startedAt, end = now), and start the new one. Tapping the running category (or Stop) stops and saves it. Entries shorter than 5 seconds are discarded (accidental taps).
3. **Backdated switch.** When switching to a new category, the user can optionally say "I actually switched N minutes ago" (chips: 5, 10, 15, custom). Then the previous entry's end = now - N min and the new timer's startedAt = now - N min. N is clamped so it never exceeds the running timer's elapsed time.
4. **Resume.** On every switch, store the old category as `previousCategoryId`. While a timer runs and `previousCategoryId` exists, show a one-tap "Resume {category name}" button that switches back to it. Clear it when the timer is stopped.
5. **Delete category = archive.** Archived categories disappear from the timer picker and manual entry pickers, but remain visible in history and charts. Settings has an "Archived" section with Restore. Optional "Delete permanently" exists only with a strong confirmation that shows how many entries will also be deleted. Archiving the category of the running timer first stops and saves that timer (after confirmation).
6. **Category edits** (name, color, type) apply retroactively everywhere, because entries reference `categoryId`. When changing type, show a short note that past statistics will change too.
7. **Overlap warning.** When saving a manual entry or editing an entry, if its time range overlaps another entry or the currently running timer's range, show a warning naming the conflicting entry. The user can "Save anyway" or cancel. Do not hard-block. Manual entry end time cannot be in the future.
8. **Midnight crossing.** An entry crossing midnight stays ONE entry. Do not split it in storage. When calculating any period, clip it: `overlapMs = max(0, min(end, rangeEnd) - max(start, rangeStart))`. History groups an entry under its start day and shows a "continues next day" badge.
9. **Running timer counts in stats.** For any period that includes "now", treat the running timer as a virtual entry with end = now.
10. **Two kinds of percentages.**
    - Category share = category time / total tracked time in the period (pie chart).
    - Productive vs Wasted = productive / (productive + wasted) and wasted / (productive + wasted). Neutral is excluded from this ratio but shown separately as time. Also show total tracked time.
11. **Duration format:** `1h 25m`, and `45m` when under an hour. Seconds only in the timer display (`HH:MM:SS`).

## 6. Screens (bottom tab bar: Timer, History, Stats, Settings)
- **Timer (home):**
  - Large centered SVG ring (circle with `stroke-dasharray` / `stroke-dashoffset`).
  - Center shows elapsed HH:MM:SS and the category name. When idle: empty ring and "Tap a category to start".
  - Goal is optional. Before starting, the user can pick a goal chip (None, 25m, 45m, 60m, 90m, 2h, custom). With a goal, the ring fills elapsed/goal. After reaching it the ring turns full/different color, shows "Goal reached" and keeps counting. Without a goal, the ring fills over 60 minutes and loops.
  - Below the ring: Stop button, then a grid of category buttons (color dot, name, today's total for that category). The running one is highlighted.
- **History:** entries grouped by day (newest first) with each day's total. Each entry shows category, time range, duration, note. Tap to edit or delete. "+ Add entry" button opens the manual entry form (category, start, end, note, date can be any past day).
- **Stats:** Day / Week / Month / Year toggle, prev/next arrows (next disabled at the current period), a period label. Doughnut chart of category share with percentages. Stacked bar chart: Day = 24 hourly bars, Week = 7 days, Month = one bar per day, Year = 12 months, stacked by category using category colors. Summary card: total tracked, productive %, wasted %, neutral time. Friendly empty state.
- **Settings:** Categories (add, edit, archive, restore), Export/Import, last exported date.

## 7. Stages (build ONLY the stage I ask for)
- **Stage 1: Foundation.** Project setup, storage adapter, store, bottom nav (History/Stats as placeholders), Timer screen (ring, goal, category buttons, Stop), categories add/edit/archive/restore/permanent delete, rules 1, 2, 5, 6, 11 and today's totals on buttons. Vitest for duration formatting and timer switching logic.
- **Stage 2: Entries and conveniences.** Manual entry form, History screen with edit/delete, overlap warning (rule 7), Resume (rule 4), backdated switch (rule 3). Overlap detection is a pure function in `time.ts` with tests.
- **Stage 3: Stats.** Range helpers in `time.ts` (start/end of day/week/month/year with date-fns, clipping per rule 8, virtual running entry per rule 9, percentages per rule 10) with thorough tests, including midnight-crossing, month boundary and year boundary cases. Stats screen with charts. Also show a small progress bar under a category button if `dailyGoalMinutes` is set (field editable in category form).
- **Stage 4: Export/Import.** Export everything as a JSON file (`schemaVersion`, `exportedAt`, categories, entries, previousCategoryId). Import validates the file, shows a summary (N categories, M entries), and offers "Replace all data" (with confirmation) or "Merge" (skip ids that already exist). Set `lastExportedAt`. Show a gentle reminder on the Settings screen if the last export was over 14 days ago or never.
- **Stage 5: PWA and deploy.** vite-plugin-pwa: manifest (name, short_name, standalone display, theme color), icons (192, 512, maskable), service worker with autoUpdate, offline support. Vercel-ready (build `npm run build`, output `dist`). README with deploy steps.

## 8. General quality rules
- Mobile-first, large tap targets, supports light/dark via `prefers-color-scheme`.
- Confirm before any destructive action.
- Handle empty states and invalid input (end before start, empty category name, duplicate category names).
- TypeScript strict mode, no `any`.