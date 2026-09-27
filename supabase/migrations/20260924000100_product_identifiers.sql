create table if not exists public.product_identifiers (
  id uuid primary key default gen_random_uuid(),

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  identifier_type text not null,
  identifier_value text not null,

  source text,
  verified boolean not null default false,

  created_at timestamptz not null default now(),

  constraint product_identifiers_type_value_key
    unique (identifier_type, identifier_value)
);

create index if not exists idx_product_identifiers_product
  on public.product_identifiers(product_id);
