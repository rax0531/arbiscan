alter table products
  add column if not exists status text not null default 'active'
    check (status in ('active', 'inactive', 'ignored'));

alter table products
  add column if not exists first_seen_at timestamptz not null default now();

alter table products
  add column if not exists last_seen_at timestamptz not null default now();

alter table products
  add column if not exists ignored_at timestamptz;

create index if not exists idx_products_status_last_seen
  on products(status, last_seen_at desc);

create index if not exists idx_products_last_seen
  on products(last_seen_at desc);

comment on column products.status is
  'Lifecycle state: active=currently tracked, inactive=not seen recently, ignored=manually excluded from future scanner results.';

comment on column products.first_seen_at is
  'First time this canonical product was observed by ArbiScan.';

comment on column products.last_seen_at is
  'Most recent time this canonical product was observed by an approved source connector.';

comment on column products.ignored_at is
  'Time the user or system marked the product as ignored.';

-- Products not observed for 7 days stop appearing as active candidates.
create or replace function mark_stale_products()
returns integer
language plpgsql
security invoker
as $$
declare
  affected integer;
begin
  update products
     set status = 'inactive',
         updated_at = now()
   where status = 'active'
     and last_seen_at < now() - interval '7 days';

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Remove old inactive products after 30 days.
-- Watchlisted products are protected from automatic deletion.
create or replace function purge_expired_products()
returns integer
language plpgsql
security invoker
as $$
declare
  affected integer;
begin
  delete from products p
   where p.status = 'inactive'
     and p.last_seen_at < now() - interval '30 days'
     and not exists (
       select 1
         from watchlists w
        where w.product_id = p.id
     );

  get diagnostics affected = row_count;
  return affected;
end;
$$;

comment on function mark_stale_products() is
  'Marks active products as inactive when they have not been observed for 7 days.';

comment on function purge_expired_products() is
  'Deletes inactive products not observed for 30 days, except products present in a watchlist.';


-- Reuse the same canonical product on every observation.
-- A manually ignored product remains ignored until explicitly changed by the user.
create or replace function upsert_product_observation(
  p_canonical_key text,
  p_title text,
  p_category text default null,
  p_source_data jsonb default null
)
returns products
language plpgsql
security invoker
as $$
declare
  result_row products;
begin
  insert into products (
    canonical_key,
    title,
    category,
    source_data,
    status,
    first_seen_at,
    last_seen_at,
    updated_at
  )
  values (
    p_canonical_key,
    p_title,
    p_category,
    p_source_data,
    'active',
    now(),
    now(),
    now()
  )
  on conflict (canonical_key) do update
    set title = excluded.title,
        category = coalesce(excluded.category, products.category),
        source_data = coalesce(excluded.source_data, products.source_data),
        last_seen_at = now(),
        updated_at = now(),
        status = case
          when products.status = 'ignored' then 'ignored'
          else 'active'
        end
  returning * into result_row;

  return result_row;
end;
$$;

comment on function upsert_product_observation(text, text, text, jsonb) is
  'Creates a canonical product once or refreshes the existing product observation without creating duplicates. Ignored products remain ignored.';
