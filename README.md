# Hourly · Personal Time Tracker

A privacy-first, client-side personal time tracker designed to measure how your time is spent and distinguish between **productive**, **wasted**, and **neutral** time. Mobile-first and fully functional offline as a Progressive Web App (PWA).

---

## Features

- **Precision Timing**: Timestamp-based timer (`now - startedAt`) that remains accurate through tab closes, phone locks, and page refreshes.
- **Goal Chips & Visual Progress**: Optional timer duration goals (25m, 45m, 60m, 90m, 2h, custom) with dynamic SVG ring animations.
- **Smart Category Switching**:
  - One-tap category switching with automatic entry logging (discards taps < 5s).
  - Backdated switch option ("I actually switched N minutes ago").
  - Instant **Resume** button to switch back to the previous category.
- **History & Manual Entries**:
  - Entries grouped by date with day totals and "continues next day" badges for midnight-crossing intervals.
  - Manual entry logging and editing with non-blocking overlap detection warnings.
- **Rich Analytics & Charts**:
  - Breakdown by Day, Week, Month, or Year.
  - Category share Doughnut chart with percentages.
  - Stacked Bar chart (24 hourly bars for day, 7 days for week, daily bars for month, 12 months for year) using custom category colors.
  - Summary metrics: total tracked, productive %, wasted %, and neutral time.
  - Category daily goal progress indicators.
- **Export & Import (Backup)**:
  - Strict JSON schema validation (`schemaVersion`, format, category integrity).
  - Flexible restore: "Merge" (skip existing IDs) or "Replace all data".
  - Gentle backup reminder if no backup has been taken in over 14 days.
- **Offline & PWA Support**:
  - Standalone mobile home-screen experience.
  - Service worker precaching for 100% offline functionality.

---

## Tech Stack

- **Framework**: [React 19](https://react.dev/) + [Vite](https://vite.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) with custom localStorage persistence adapter
- **Charts**: [Chart.js](https://www.chartjs.org/) + [react-chartjs-2](https://react-chartjs-2.js.org/)
- **Date Math**: [date-fns](https://date-fns.org/)
- **PWA**: [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- **Testing**: [Vitest](https://vitest.dev/)

---

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm 9+

### Installation

```bash
# Clone or navigate to the repository
cd Hourly

# Install dependencies
npm install
```

### Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Running Unit Tests

Hourly includes 81 unit tests covering pure time functions, clipping across midnight/month/year boundaries, virtual running timer calculations, percentages, and overlap detection:

```bash
npm test
```

### Production Build & Preview

```bash
# Typecheck and build optimized static assets
npm run build

# Preview production build locally with Service Worker enabled
npm run preview
```

---

## Deploying to Vercel

Hourly is a pure static web application. It requires **no server, no database, no backend API, and no environment variables**.

### Method 1: Deploy via Vercel Web Dashboard (Recommended)

1. Push your repository to **GitHub**, **GitLab**, or **Bitbucket**.
2. Log in to [Vercel](https://vercel.com/) and click **"Add New Project"**.
3. Import your `Hourly` repository.
4. In the project configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Environment Variables**: None required.
5. Click **"Deploy"**.
6. Once deployment finishes, Vercel provides a production HTTPS URL (e.g., `https://hourly-time-tracker.vercel.app`).

### Method 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Deploy directly from terminal
vercel

# For production deployment:
vercel --prod
```

---

## Adding to Phone Home Screen (PWA Installation)

Hourly is configured as a standalone Progressive Web App. Installing it to your phone provides a native app-like experience with no browser address bar and instant offline loading.

### On iOS (Safari)

> **Note**: iOS requires using **Safari** to install PWAs.

1. Open your deployed Vercel URL in **Safari**.
2. Tap the **Share** button at the bottom of the screen (the square with an arrow pointing upward).
3. Scroll down the share sheet and select **"Add to Home Screen"**.
4. (Optional) Confirm or customize the name `Hourly`.
5. Tap **Add** in the top right corner.
6. The Hourly icon will now appear on your home screen. Tapping it opens the app in fullscreen standalone mode.

### On Android (Chrome)

1. Open your deployed Vercel URL in **Google Chrome**.
2. An **"Add Hourly to Home screen"** or **"Install app"** banner will appear at the bottom.
   - If the banner does not appear, tap the **three dots menu (⋮)** in the top right.
   - Select **"Add to Home screen"** or **"Install app"**.
3. Confirm by tapping **Install** in the prompt.
4. The Hourly app will be added to your app drawer and home screen.

### On Desktop (Chrome / Edge / Brave)

1. Navigate to the app URL.
2. Click the **Install** icon on the right side of the URL/address bar.
3. Click **Install**. Hourly will run in its own dedicated window.

---

## App Icons & Customization

The app includes standard PWA icons in the `public/` folder:

- `public/icon.svg` — Master vector icon
- `public/icon-maskable.svg` — Master vector icon with safe-zone margin for Android adaptive mask shapes
- `public/pwa-192x192.png` — Standard 192x192 PNG icon
- `public/pwa-512x512.png` — Standard 512x512 PNG icon
- `public/pwa-maskable-512x512.png` — 512x512 Maskable PNG icon

### How to Convert or Replace Icons

If you wish to customize the app icons:

1. Edit or replace `public/icon.svg`.
2. Convert the SVG to PNG at 192x192 and 512x512 sizes using any of the following tools:
   - **Squoosh**: [squoosh.app](https://squoosh.app/) (drag-and-drop web tool)
   - **Sharp CLI**:
     ```bash
     npx sharp-cli -i public/icon.svg -o public/pwa-192x192.png resize 192 192
     npx sharp-cli -i public/icon.svg -o public/pwa-512x512.png resize 512 512
     npx sharp-cli -i public/icon-maskable.svg -o public/pwa-maskable-512x512.png resize 512 512
     ```
   - **Inkscape**:
     ```bash
     inkscape public/icon.svg -w 192 -h 192 -o public/pwa-192x192.png
     inkscape public/icon.svg -w 512 -h 512 -o public/pwa-512x512.png
     ```
3. Re-run `npm run build` to update the service worker manifest precache.

---

## Architecture & Storage Isolation

All client state is persisted through a custom storage adapter interface defined in `src/storage/index.ts`. Components never interact with `localStorage` directly, allowing future storage migrations (e.g. IndexedDB or remote sync) with zero modifications to UI components or store actions.
