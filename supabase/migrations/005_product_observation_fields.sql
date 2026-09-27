-- Rakuten 및 향후 다른 source connector에서 공통으로 사용할
-- canonical product observation upsert 함수 확장.
create or replace function upsert_product_observation(
  p_canonical_key text,
  p_title text,
  p_brand text default null,
  p_model text default null,
  p_category text default null,
  p_image_url text default null,
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
    brand,
    model,
    category,
    image_url,
    source_data,
    status,
    first_seen_at,
    last_seen_at,
    updated_at
  )
  values (
    p_canonical_key,
    p_title,
    p_brand,
    p_model,
    p_category,
    p_image_url,
    p_source_data,
    'active',
    now(),
    now(),
    now()
  )
  on conflict (canonical_key) do update
    set title = excluded.title,
        brand = coalesce(excluded.brand, products.brand),
        model = coalesce(excluded.model, products.model),
        category = coalesce(excluded.category, products.category),
        image_url = coalesce(excluded.image_url, products.image_url),
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

comment on function upsert_product_observation(text, text, text, text, text, text, jsonb) is
  'Creates or refreshes a canonical product observation while preserving ignored products.';

