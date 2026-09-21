alter table products
  add column if not exists source_data jsonb;

comment on column products.source_data is
  'ArbiScan product fields used by the web UI. Seed/import data only; production market data will be normalized into related listing tables.';