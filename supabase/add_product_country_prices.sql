-- ============================================================
-- 제품별 국가별 가격관리 (product_country_prices)
-- ============================================================
create table if not exists public.product_country_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  country text not null,
  price numeric not null default 0,
  currency text not null default 'USD',
  moq numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, country)
);
create index if not exists product_country_prices_product_id_idx on public.product_country_prices(product_id);

drop trigger if exists trg_product_country_prices_updated_at on public.product_country_prices;
create trigger trg_product_country_prices_updated_at before update on public.product_country_prices
  for each row execute procedure set_updated_at();

alter table public.product_country_prices enable row level security;

drop policy if exists "product_country_prices_select" on public.product_country_prices;
drop policy if exists "product_country_prices_insert" on public.product_country_prices;
drop policy if exists "product_country_prices_update" on public.product_country_prices;
drop policy if exists "product_country_prices_delete" on public.product_country_prices;

-- 제품관리 권한에 종속
create policy "product_country_prices_select" on public.product_country_prices
  for select using (has_menu_permission('products', 'view'));
create policy "product_country_prices_insert" on public.product_country_prices
  for insert with check (has_menu_permission('products', 'create'));
create policy "product_country_prices_update" on public.product_country_prices
  for update using (has_menu_permission('products', 'edit')) with check (has_menu_permission('products', 'edit'));
create policy "product_country_prices_delete" on public.product_country_prices
  for delete using (has_menu_permission('products', 'delete'));

revoke all on table public.product_country_prices from anon;
grant select, insert, update, delete on table public.product_country_prices to authenticated;

-- 확인:
--   select * from public.product_country_prices limit 5;
