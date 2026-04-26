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

## Quality gates

```bash
npm run typecheck
npm test
npm run build
```
