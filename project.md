# ArbiScan Project

## 1. Overview

ArbiScan is a web application for discovering potential cross-border e-commerce arbitrage opportunities.

The system compares:

* Overseas marketplace purchase prices
* Korean marketplace selling prices

and estimates whether a product may remain profitable after all relevant costs.

The initial target markets are:

* Japan
* United States
* Europe

The initial target market is Korea.

---

## 2. Business concept

The basic business model is:

> Find a product overseas at a sufficiently low total acquisition cost, then identify a Korean selling opportunity where the expected selling price leaves a meaningful margin.

The application should help answer:

> "If I buy this product overseas and sell it in Korea, how much money would actually remain after all costs?"

The application is NOT intended to simply display the largest difference between two sticker prices.

A large price difference is useful only when:

* The products are actually the same or sufficiently equivalent.
* The overseas price is real and available.
* The Korean selling price is realistic.
* Shipping is accounted for.
* Exchange rates are current enough.
* Customs/tax assumptions are appropriate.
* Marketplace fees are accounted for.
* The product can legally/practically be imported and sold.
* The opportunity is not based on stale data.

---

## 3. Core calculation concept

The conceptual calculation is:

```text
Overseas purchase price
+ overseas domestic shipping
+ international shipping
+ customs duty
+ import VAT
+ other import costs
+ payment/FX costs
+ Korean marketplace selling fees
+ other selling costs
= total landed/selling cost
```

Then:

```text
Expected Korean selling price
- total cost
= estimated net profit
```

And:

```text
estimated net profit
÷ total cost
= ROI
```

The exact formula must be implemented in deterministic code and may evolve as the business rules become more precise.

Never use an LLM as the final calculator.

---

## 4. Product identity

A product must have a stable canonical identity.

Examples:

```text
Brand: Ricoh
Model: GR III
Variant: Standard
```

or:

```text
Brand: Shimano
Model: Stella C2000S
Generation: 2022
```

The same product may have listings on:

* Amazon Japan
* Yahoo Japan
* Rakuten
* Amazon US
* eBay
* Korean marketplaces

These listings should point to the same canonical product when they represent the same product.

---

## 5. Canonical key

Products use:

`canonical_key`

The canonical key should be stable and should not be based merely on the current listing title.

Prefer identifiers such as:

* Manufacturer model number
* SKU
* JAN
* UPC
* EAN
* GTIN
* ASIN where appropriate
* Manufacturer part number

When no authoritative identifier exists, construct a normalized identity from multiple product attributes.

---

## 6. Marketplace observations

A marketplace listing is an observation of a product at a particular point in time.

Important fields include:

* Marketplace
* External ID
* Product title
* URL
* Currency
* Price
* Condition
* Availability
* Seller
* Observed timestamp

Prices are expected to change.

Listings can disappear.

Therefore the database should represent observations rather than treating an old listing as permanently valid.

---

## 7. Product lifecycle

ArbiScan deliberately avoids keeping every discovered product forever.

Current lifecycle:

```text
active
   ↓
not observed for 7 days
   ↓
inactive
   ↓
not observed for 30 days
   ↓
deleted
```

Exceptions:

* `ignored` products remain ignored.
* Watchlisted products are protected from automatic deletion.

This policy is intentionally designed to prevent the product table from growing indefinitely with obsolete marketplace data.

See:

`docs/database.md`

and:

`supabase/migrations/003_product_lifecycle.sql`

for the authoritative implementation.

---

## 8. Current database concepts

The current schema contains the following major entities.

### products

Canonical product identity and lifecycle.

### market_listings

Current/observed overseas marketplace offers.

### korean_listings

Observed Korean marketplace offers.

### price_history

Historical price observations.

### exchange_rates

Foreign exchange observations.

### arbitrage_opportunities

Calculated arbitrage results.

### watchlists

Products monitored by users.

### alert_rules

Conditions for triggering alerts.

### alert_logs

History of alert delivery.

---

## 9. Current architecture

```text
                    ┌──────────────────┐
                    │ Overseas sources │
                    │ Japan / US / EU  │
                    └────────┬─────────┘
                             │
                             ▼
                    Marketplace connector
                             │
                             ▼
                    Normalize listing data
                             │
                             ▼
                    Product identification
                             │
                  ┌──────────┴──────────┐
                  │                     │
                  ▼                     ▼
          Overseas listing       Korean listing
                  │                     │
                  └──────────┬──────────┘
                             ▼
                    Deterministic pricing
                       / cost engine
                             │
                             ▼
                  Arbitrage opportunity
                             │
                 ┌───────────┴───────────┐
                 ▼                       ▼
             Watchlist                 Alerts
```

Current intended deployment architecture:

```text
React / Vite
     │
     ▼
Cloudflare Pages

Cloudflare Workers
     │
     ├── API
     ├── scheduled jobs
     └── future queues

     │
     ▼
Supabase PostgreSQL
```

---

## 10. Current repository structure

```text
arbiscan/
├── apps/
│   └── web/
│       └── src/
│           ├── components/
│           ├── data/
│           ├── lib/
│           ├── utils/
│           ├── App.tsx
│           ├── main.tsx
│           ├── types.ts
│           └── index.css
│
├── workers/
│   └── api/
│       └── src/
│
├── packages/
│   ├── calculator/
│   ├── config/
│   └── types/
│
├── supabase/
│   └── migrations/
│
└── docs/
```

---

## 11. Frontend

The frontend currently uses:

* React
* TypeScript
* Vite
* Tailwind/CSS-based styling

The main application is:

`apps/web/src/App.tsx`

Existing UI concepts include:

* Scanner
* Arbitrage table
* Margin calculator
* Watchlist / alerts
* Database connection status
* Product lookup

The existing UI should be preserved while the data layer gradually moves from mock/local state to real backend data.

---

## 12. Current development state

The project began as a Google AI Studio prototype and has been migrated into a maintainable GitHub monorepo.

Current repository:

`rax0531/arbiscan`

The project already contains:

* React web application
* Cloudflare Workers API scaffold
* Shared calculator package
* Shared types/config packages
* Supabase schema
* Product source data migration
* Product lifecycle migration
* Documentation
* Development mock data

Supabase connectivity has already been established during development.

---

## 13. Marketplace connector strategy

Connector implementation should be incremental.

Planned order:

### Phase 1

Amazon Japan or another permitted/authorized Japanese product source.

### Phase 2

Korean marketplace price source.

### Phase 3

Additional overseas sources, potentially including:

* Yahoo Japan
* Rakuten
* Amazon US
* eBay
* Walmart
* Target
* Other permitted sources

For every connector:

* Verify API availability.
* Verify terms of service.
* Verify commercial-use conditions.
* Verify rate limits.
* Verify authentication requirements.
* Avoid CAPTCHA/anti-bot circumvention.
* Prefer official or authorized data sources.

Connector code must be isolated so that adding a new marketplace does not require rewriting the calculation engine.

---

## 14. Product matching strategy

Product matching is more important than raw price collection.

A false match can create a completely false arbitrage opportunity.

Matching should consider:

1. Brand
2. Manufacturer model number
3. Product identifier
4. Variant
5. Size/capacity
6. Color
7. Generation
8. Condition
9. Included accessories
10. Structured marketplace attributes
11. Title similarity
12. AI-assisted semantic matching

The system should retain a confidence level.

Example:

```text
match_confidence = 0.98
```

High-confidence matches can be presented normally.

Low-confidence matches should be clearly identified and should not automatically be treated as reliable opportunities.

---

## 15. Price reliability

Each price should have an observation timestamp.

The system should eventually distinguish between:

* Current price
* Recently observed price
* Stale price
* Historical price

A stale overseas price should not generate the same confidence as a recently confirmed price.

Likewise, an old Korean listing should not be treated as today's achievable selling price.

---

## 16. Cost calculation

The calculation engine should eventually support:

### Purchase

* Overseas item price
* Domestic overseas shipping
* Coupon/discount where verified
* Currency conversion

### Import

* International shipping
* Insurance where applicable
* Customs duty
* Import VAT
* Other import costs

### Selling

* Korean marketplace commission
* Payment processing fee
* Domestic shipping
* Packaging
* Expected return/refund cost where appropriate
* Other operating costs

### Result

* Total cost
* Expected selling price
* Estimated gross profit
* Estimated net profit
* ROI
* Margin percentage
* Calculation timestamp

---

## 17. Important distinction: price difference vs arbitrage opportunity

ArbiScan must distinguish:

### Price difference

```text
Korean price - overseas price
```

from:

### Actual arbitrage opportunity

```text
Korean achievable selling price
- all relevant costs
```

A product with a 40% headline price difference may have little or no real profit after:

* shipping
* duty
* VAT
* selling fees
* FX cost

Therefore the scanner should prioritize **net economics**, not headline price gaps.

---

## 18. Risk information

Potential risks should be surfaced rather than hidden.

Examples:

* Used product
* Missing accessories
* Regional model
* Different voltage
* Different warranty
* Import restriction
* Certification requirement
* Fragile product
* High return risk
* Uncertain product matching
* Stale price
* Low Korean sales volume
* Seller reliability concerns

AI may help extract risk information from listing descriptions.

The system should distinguish:

```text
verified fact
```

from:

```text
AI inference
```

and:

```text
user-configured assumption
```

---

## 19. Scanner philosophy

The scanner should eventually answer:

> "Show me products where the estimated net profit is meaningful, the product match is reliable, the price is recent, and the Korean selling opportunity appears realistic."

Possible filters:

* Minimum net profit
* Minimum ROI
* Maximum purchase price
* Marketplace
* Country
* Category
* Condition
* Match confidence
* Price freshness
* Risk level

---

## 20. Watchlist

Users should be able to save products they want to monitor.

A watchlisted product should:

* survive automatic product cleanup
* retain relevant price history
* be eligible for future alerts

Potential future alerts:

```text
海外価格が X 이하
ROI가 Y% 이상
예상 순이익이 Z원 이상
한국 판매가격이 X 이상
가격차이가 일정 수준 이상
```

---

## 21. Alerts

Potential future notification channels:

* Telegram
* Email
* Web notifications
* Other supported notification services

Alert delivery should be recorded in `alert_logs`.

Alerts should not repeatedly fire for the same unchanged opportunity unless the configured rule permits it.

---

## 22. AI's role

AI is useful for:

* Product title normalization
* Product identity extraction
* Model number extraction
* Category classification
* Cross-market product matching
* Listing description analysis
* Risk text extraction
* Translation
* Search-query generation
* Data-quality assistance

AI should NOT be trusted as the authoritative source for:

* Money calculations
* FX calculations
* Taxes
* Customs
* Marketplace fee calculations
* Final profit
* ROI
* Database integrity

Those must remain deterministic.

---

## 23. Long-term goal

The long-term goal is a system that can continuously:

```text
Collect
  ↓
Normalize
  ↓
Identify products
  ↓
Match Korean listings
  ↓
Update FX
  ↓
Calculate landed cost
  ↓
Calculate selling fees
  ↓
Calculate net profit
  ↓
Score data confidence
  ↓
Detect opportunities
  ↓
Notify user
```

The user should eventually be able to open ArbiScan and see a continuously updated list of potential cross-border resale opportunities rather than manually searching individual products.

---

## 24. Development principle

Build the system in small verified steps.

Priority order:

1. Reliable product identity
2. Reliable marketplace observations
3. Reliable Korean price observations
4. Deterministic cost calculation
5. Reliable product matching
6. Arbitrage detection
7. Historical analysis
8. Watchlists
9. Alerts
10. Additional marketplaces
11. Automation and scheduled collection

Do not optimize for the number of marketplaces before the quality of the core calculations and matching system is reliable.

The quality of ArbiScan depends more on the accuracy of its data and calculations than on the number of sources it can scan.
