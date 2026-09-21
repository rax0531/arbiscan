# ArbiScan development setup

## 1. GitHub

Create a **private** repository named `arbiscan` (do not add README/.gitignore because this project already has them), then from the project root run:

```bash
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/arbiscan.git
git branch -M main
git push -u origin main
```

## 2. Supabase

Create a new Supabase project. In SQL Editor, run:

```text
supabase/migrations/001_initial_schema.sql
```

Then copy the Project URL and Publishable key from the project's Connect/API Keys area into:

```text
apps/web/.env.local
```

Example:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
```

Do not put the Supabase secret key in `apps/web/.env.local`. It belongs only in the worker/server environment.

## 3. Run locally

From the repository root:

```bash
npm install
npm --prefix apps/web install
npm run dev:web
```

Open `http://localhost:3000`.

The small `DB` indicator at the upper-right can test a real read against `products`.
