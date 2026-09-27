# ArbiScan AI Development Rules

## 1. Project identity

ArbiScan is an arbitrage-scanning application that discovers price differences between overseas online marketplaces and Korean marketplaces.

The core business goal is to identify products that may have a meaningful resale margin after accounting for:

* Overseas purchase price
* Foreign exchange rate
* International shipping
* Domestic shipping where applicable
* Customs duty
* Import VAT
* Marketplace selling fees
* Payment fees
* Other operating costs
* Expected selling price

The application is a decision-support tool. It must not claim that an opportunity is guaranteed to be profitable.

---

## 2. Current architecture

This is a pnpm workspace / monorepo.

### Main components

* `apps/web`

  * React + TypeScript + Vite frontend
  * Main user interface

* `workers/api`

  * Cloudflare Workers API
  * Backend/API and future scheduled collection entry point

* `packages/calculator`

  * Shared deterministic calculation logic
  * Financial calculations must remain independent of AI reasoning

* `packages/types`

  * Shared TypeScript types

* `packages/config`

  * Shared configuration

* `supabase`

  * PostgreSQL database schema and migrations

* `docs`

  * Architecture, database, API, connector and setup documentation

### Current intended data flow

Marketplace connector
→ normalized listing
→ product matching
→ Korean listing
→ deterministic cost calculation
→ arbitrage opportunity
→ watchlist / alert

AI may assist with normalization, product matching and risk-text extraction.

AI must NOT be the source of truth for monetary calculations.

---

## 3. General development rules

### 3.1 Inspect before modifying

Before changing code:

1. Inspect the existing implementation.
2. Identify the files and modules involved.
3. Check related types, database schema and existing utilities.
4. Determine whether an existing function/component can be reused.
5. Explain the proposed change when the task is non-trivial.

Do not rewrite large portions of the application simply because a different implementation appears cleaner.

Preserve working functionality unless the requested change explicitly replaces it.

---

## 4. Safety rules for database changes

Supabase database changes are high-impact.

### Never

* Directly modify production tables merely to make a feature work.
* Delete existing migrations.
* Rewrite an already-applied migration.
* Rename/remove columns without checking all application references.
* Drop tables or data unless explicitly requested.
* Disable RLS merely to bypass an error.
* Invent database columns based on assumptions.

### Always

* Inspect the current migrations first.
* Use a new numbered migration for schema changes.
* Preserve backward compatibility when practical.
* Check foreign keys and cascade behavior.
* Consider existing data before changing constraints.
* Clearly explain destructive database operations before executing them.
* Test database changes against development/test data when possible.

The existing migration history is authoritative.

Current migrations:

* `001_initial_schema.sql`
* `002_product_source_data.sql`
* `003_product_lifecycle.sql`

Do not assume the database matches an imagined schema. Read the actual migrations.

---

## 5. Product lifecycle rules

ArbiScan must NOT create a new canonical product every time a marketplace is scanned.

Products are identified using `canonical_key`.

Use the existing product lifecycle model:

* `active`
* `inactive`
* `ignored`

Current retention policy:

* No observation for 7 days → product may become `inactive`.
* Inactive for more than 30 days → product may be deleted.
* Watchlisted products are protected from automatic deletion.
* Manually `ignored` products must not automatically become active again.

When processing a marketplace observation:

1. Reuse the canonical product if `canonical_key` matches.
2. Update `last_seen_at`.
3. Update current listing information.
4. Record price observations separately.
5. Do not create duplicate canonical products.

Use the existing `upsert_product_observation()` mechanism where applicable.

---

## 6. Financial calculation rules

All financial calculations must be deterministic and reproducible.

Do NOT ask an LLM to directly calculate or decide:

* Exchange rates
* Customs duty
* Import VAT
* Shipping cost
* Marketplace fees
* Total acquisition cost
* Net profit
* ROI
* Margin percentage

These values must be calculated by TypeScript/database logic using explicit formulas and inputs.

AI can help determine:

* Product identity
* Model number
* Brand
* Category
* Condition text
* Whether two listings probably refer to the same product
* Risk descriptions

But the final numerical calculation must be performed by deterministic code.

---

## 7. Product matching rules

Product matching is one of the most important parts of ArbiScan.

Never match products solely because their titles look similar.

Prefer the following evidence, roughly in this order:

1. Manufacturer part number / model number
2. SKU / ASIN / JAN / UPC / EAN / GTIN where applicable
3. Brand + exact model
4. Variant information
5. Capacity / size / color / generation
6. Structured marketplace attributes
7. Title similarity
8. AI semantic similarity

AI-generated matching should have a confidence score.

Low-confidence matches must not automatically become high-confidence arbitrage opportunities.

---

## 8. Marketplace connector rules

Before implementing a new marketplace connector:

1. Check whether an official API, feed or authorized data source exists.
2. Check terms of service.
3. Check commercial-use restrictions.
4. Check rate limits.
5. Check robots/CAPTCHA restrictions.
6. Check authentication requirements.
7. Check whether scraping is legally/contractually appropriate.
8. Prefer official or authorized sources when available.

Never implement a scraper that intentionally bypasses CAPTCHA, authentication, access controls or anti-bot mechanisms.

Connector-specific code should be isolated from the calculation engine.

---

## 9. Marketplace normalization

Different marketplaces use different currencies, conditions, shipping rules and product identifiers.

Normalize external data into the internal ArbiScan model.

At minimum preserve:

* Source marketplace
* External product/listing ID
* Title
* URL
* Currency
* Price
* Condition
* Availability
* Seller where available
* Observed timestamp
* Source-specific raw metadata when appropriate

Do not discard source information merely because the normalized field is currently unused.

---

## 10. Currency and FX rules

Never hard-code an exchange rate into business logic.

Exchange rates must have:

* Base currency
* Quote currency
* Rate
* Observation timestamp
* Source where practical

Calculations must use an explicit FX observation.

If the exchange rate is stale or unavailable, the opportunity should be marked accordingly rather than silently using an arbitrary value.

---

## 11. Tax and customs rules

Tax and customs calculations must be configurable and versionable.

Do not assume that every product has the same:

* Customs duty
* VAT treatment
* De minimis treatment
* HS code
* Import restriction
* Certification requirement

Do not present an estimated customs/tax value as an official customs determination.

If the required information is unavailable, expose the uncertainty.

---

## 12. Selling fee rules

Marketplace fees must be represented as explicit configuration/data.

Do not scatter hard-coded fee percentages throughout React components.

Prefer:

* configuration
* database tables
* calculation functions
* versioned fee schedules

The frontend should display the result of the calculation engine rather than independently recalculating financial values.

---

## 13. Frontend rules

Current frontend:

`apps/web`

Main application currently includes functionality such as:

* Scanner
* Arbitrage table
* Margin calculator
* Watchlist / alerts
* Supabase connection testing
* Product lookup

When modifying the frontend:

* Preserve existing working tabs/features.
* Avoid putting large amounts of business logic directly inside `App.tsx`.
* Reuse existing components and utilities.
* Keep TypeScript types explicit.
* Avoid unnecessary global state.
* Avoid introducing a new state-management library unless justified.
* Keep API/database access separate from presentation components.

---

## 14. API rules

Backend/API code belongs in:

`workers/api`

Frontend should not contain secrets.

Never place:

* Supabase service-role keys
* marketplace private API keys
* payment credentials
* private tokens

inside frontend code or public environment variables.

Only public client-safe configuration may be exposed to the browser.

---

## 15. Environment variables

Never commit real secrets.

Use:

* `.env.example`
* local `.env.local`
* Cloudflare/Supabase secret configuration where appropriate

Never print secret values into logs, issues, commits or documentation.

If an existing secret appears to have been committed accidentally, stop and report it rather than attempting to silently rewrite history.

---

## 16. Testing and validation

After meaningful code changes:

1. Run the relevant TypeScript/build checks.
2. Run lint if configured.
3. Check the browser UI for frontend changes.
4. Test the changed calculation with known inputs.
5. Check for regressions in related features.

For calculation changes, test edge cases including:

* zero shipping
* missing shipping
* zero tax
* missing tax
* currency conversion
* very large prices
* very small prices
* negative/zero profit
* unavailable selling price
* missing exchange rate
* stale exchange rate

Never consider a feature complete merely because the TypeScript compiler succeeds.

---

## 17. Git rules

Use small, understandable commits.

Prefer commit messages such as:

* `feat: add Amazon Japan connector`
* `fix: correct import VAT calculation`
* `refactor: extract product matching service`
* `docs: update database lifecycle rules`

Do not combine unrelated changes into one commit.

Never use force-push or destructive Git operations unless explicitly requested and the consequences have been explained.

Before large changes, ensure the working tree state is understood.

---

## 18. AI agent behavior

The AI agent must behave like a careful software engineer, not an autonomous administrator.

Before a substantial change:

* inspect
* plan
* implement
* test
* summarize

For destructive or high-impact operations, stop and ask for explicit confirmation.

Do not:

* delete user data
* reset the database
* drop tables
* overwrite migrations
* modify production configuration
* rotate credentials
* change deployment configuration

without explicit authorization.

---

## 19. Do not over-engineer

ArbiScan is currently under active development.

Prefer:

* simple solutions
* small changes
* reusable functions
* clear data models
* deterministic calculations

Avoid introducing complex infrastructure before there is a demonstrated need.

The goal is a reliable working product, not an unnecessarily elaborate architecture.

---

## 20. Documentation

When a change materially affects architecture, database structure, API behavior or connector behavior, update the appropriate documentation under `docs/`.

Relevant documentation:

* `docs/architecture.md`
* `docs/database.md`
* `docs/api.md`
* `docs/connectors.md`
* `docs/setup.md`

Keep documentation consistent with the actual implementation.

---

## 21. Current development priority

The long-term development direction is:

1. Stabilize existing web application.
2. Connect the frontend cleanly to Supabase/API.
3. Make deterministic margin calculation reliable.
4. Implement exchange-rate handling.
5. Implement marketplace connectors using permitted data sources.
6. Normalize overseas listings.
7. Match overseas products with Korean listings.
8. Calculate actual landed cost.
9. Detect meaningful arbitrage opportunities.
10. Persist watchlists.
11. Add alerts.
12. Improve historical price analysis.
13. Add additional marketplaces gradually.

Do not skip directly to complex multi-marketplace automation before the underlying product matching and calculation pipeline is reliable.
