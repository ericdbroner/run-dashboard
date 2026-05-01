# Run Planner Desktop (Web v1)

Local-only desktop-focused run calendar/planner built with React, TypeScript, Vite, and Dexie (IndexedDB).

## Features

- Month-grid calendar with workout count markers per day
- Day detail panel with template-based workout creation
- Workout editing (date, title, type, distance, duration, notes)
- Workout status tracking (`planned`, `completed`, `skipped`)
- Local persistence in IndexedDB with seeded default templates
- No backend, no sync, no plan generator, no import/export

## Run

```bash
npm install
npm run dev
```

Use this exact URL for day-to-day use:

- `http://127.0.0.1:5173/`

Important: IndexedDB is scoped to exact origin (`scheme + host + port`).
If you switch to a different URL (for example `http://127.0.0.1:4173/` or `http://localhost:5173/`), you will see a different local database.

## Quality gates

```bash
npm run typecheck
npm test
npm run build
```
