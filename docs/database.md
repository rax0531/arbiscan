# Database model

`products` = canonical product identity and lifecycle state.  
`market_listings` and `korean_listings` = observed offers.  
`price_history` = price observations.  
`arbitrage_opportunities` = calculated results.  
`watchlists`, `alert_rules`, `alert_logs` = monitoring and notifications.

## Product lifecycle

ArbiScan does **not** create a new `products` row every time a crawler sees a product.

The same canonical product is reused through `canonical_key`.

### Product status

- `active`: currently being tracked and eligible for Scanner results.
- `inactive`: not observed for 7 days. Historical data remains temporarily available.
- `ignored`: manually excluded by the user. Future crawls must not automatically make it active again.

### Retention policy

- `first_seen_at`: first observation time.
- `last_seen_at`: most recent observation time.
- After **7 days without an observation**, active products can be marked `inactive`.
- After **30 days without an observation**, inactive products can be permanently deleted.
- Products in a user's `watchlists` are protected from automatic deletion.
- Price history and related listing/opportunity rows are removed automatically when their parent product is deleted through the existing foreign-key cascade rules.

The migration `003_product_lifecycle.sql` provides:

- `mark_stale_products()` — marks products older than 7 days as inactive.
- `purge_expired_products()` — deletes inactive products older than 30 days unless they are watchlisted.

These cleanup functions are database primitives for the application/job scheduler to call later. We will add scheduled execution after the first real marketplace connector is working.

## Important data rule

A crawler should **upsert the canonical product**, not insert a new product on every crawl:

1. Call `upsert_product_observation()` with the stable `canonical_key`.
2. Update `last_seen_at` on an existing observation.
3. Keep the product `active` unless it is manually `ignored`.
4. Store the current marketplace offer in `market_listings`.
5. Store historical price observations in `price_history`.

This keeps product identity stable while allowing prices and listings to change over time.
