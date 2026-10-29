# Dairy Store Frontend (mock data only)

Copy of the Dairy Store Scheduler with **all Firebase removed** (no Auth, Firestore, or Analytics). Everything runs in the browser: the mock API answers every `/api/*` call and all data is saved to `localStorage`, so it survives reloads and syncs between tabs. The roster starts from the seed staff list.

Weekly scheduling UI for **Bethlehem Dairy Store** (Linden & Lehigh). Swap `apiFetch` in `src/lib/api/client.ts` when a real backend is ready.

**Core flow:** Choose week → check availability → build schedule → edit → approve & export.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Shared scheduling/validation code under `src/lib/` (usable from your backend)
- UI calls `/api/*` — implement those routes (or proxy to another service) to make the app live

## Install & run

```bash
cd dairy-store-scheduler
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Until your API exists, data loads will fail with a friendly error.

## Tests

Domain logic tests (no database):

```bash
npm test
npm run build
```

## API surface the UI expects

Implement handlers under `src/app/api/` (or change fetch URLs in the UI). Endpoints used today:

| Method | Path | Used by |
| --- | --- | --- |
| GET | `/api/bootstrap?week=&mode=shell` | Home — initial shell |
| POST | `/api/session` | Start / restore session, photo key |
| GET/PATCH | `/api/availability` | Availability grid |
| GET/POST/PATCH | `/api/schedule` | Build, edit, approve |
| GET/PATCH | `/api/settings` | Settings & history |
| GET/PATCH | `/api/employees` | Employee list |
| GET/POST | `/api/ocr` (+ `/photo`, `/crop`, `/restore`, `/reread`) | Calendar photo flow |
| GET | `/api/export?week=&format=csv` | CSV download |
| GET | `/api/print?weekStart=` | Print view |
| GET | `/api/names` | Name resolution helper |

Reference implementations lived in git history before backend removal. Reuse `src/lib/scheduler.ts`, `validation.ts`, `export.ts`, and related modules in your handlers.

## Demo sign-in (no real accounts)

- **Admin Login → "Sign in as demo manager"** signs in as `manager@demo.local` (`src/lib/mock/mockAuth.ts`).
- **User Login** signs in as the seeded employee **Jenn Stone**.
- Storage lives in `src/lib/mock/localDb.ts`. App state is in `src/lib/mock/persistence.ts`, requests in `src/lib/scheduleRequests.ts`, and published schedules in `src/lib/publishedSchedules.ts`.
- To start over, clear the site's localStorage (keys start with `dairy-store-mock:`).

## What stays in the repo

- Full UI (home, employees, history, settings, print, login shell)
- Roster seed data, DNA helpers, staffing targets, schedule builder, validation, CSV export helpers
- OCR **types** and mark-merge utilities (vision pipeline is not included)

## Out of scope (by design)

- No bundled database, Prisma, or `.data/` file store
- No real authentication or server — demo accounts only, data stays in the browser
- No OpenAI/sharp vision pipeline — wire OCR in your backend if needed
# scheduler-frontend
