alter table exchange_rates
  add column if not exists source text;

alter table exchange_rates
  add column if not exists rate_date date;

update exchange_rates
set
  source = coalesce(source, 'legacy'),
  rate_date = coalesce(rate_date, observed_at::date);

alter table exchange_rates
  alter column source set not null;

alter table exchange_rates
  alter column rate_date set not null;

create unique index if not exists ux_exchange_rates_source_date_pair
  on exchange_rates (
    source,
    rate_date,
    base_currency,
    quote_currency
  );
