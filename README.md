# ArbiScan

This repository is the first migration step from the Google AI Studio prototype to a maintainable monorepo.

## Current status

- Existing React UI moved to `apps/web`.
- Cloudflare Workers API scaffold at `workers/api`.
- Shared calculation package at `packages/calculator`.
- Shared types/config packages.
- Supabase initial schema at `supabase/migrations/001_initial_schema.sql`.
- Existing mock data preserved at `apps/web/src/data/mockProducts.ts`.

## Run web

```bash
cd apps/web
npm install
npm run dev
```

## Run API

```bash
cd workers/api
npm install
npm run dev
```

## Next implementation order

1. Verify web build.
2. Create GitHub repository and push this scaffold.
3. Create Supabase project and apply the migration.
4. Convert mock products to seed data.
5. Replace App.tsx mock state with API-backed state.
6. Implement deterministic calculation service.
7. Implement first permitted marketplace connector.
8. Add Korean price observations.
9. Replace Scanner's simulated rescan with a real job.
10. Add watchlist persistence and Telegram alerts.


## Setup

See [docs/setup.md](docs/setup.md) for GitHub, Supabase, environment variables, and local development.
