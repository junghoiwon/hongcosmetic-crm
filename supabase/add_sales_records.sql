-- ============================================================
-- 직접 판매실적 입력 (sales_records / sales_record_items)
-- ============================================================
-- 견적서(quotations)와는 별개로, 견적 없이 바로 등록하거나 견적을
-- 전환해서 만들 수 있는 판매실적 기록입니다. 결제상태/판매채널/환율
-- 등 견적서에는 없는 필드가 있어 기존 테이블을 확장하는 대신 새로
-- 만들되, source_quotation_id로 원본 견적서를 "참조"만 하고 삭제해도
-- 원본 견적서에는 영향이 없도록 on delete set null로 연결합니다.

create table if not exists public.sales_records (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.customers(id) on delete set null,
  contact_id uuid references public.client_contacts(id) on delete set null,
  rep text not null default '',
  sale_date date not null default current_date,
  sale_type text not null default '직접입력',
  order_number text not null default '',
  payment_status text not null default '미입금',
  expected_payment_date date,
  actual_payment_date date,
  sales_channel text not null default '',
  country text not null default '',
  currency text not null default 'KRW',
  exchange_rate numeric not null default 1,
  krw_amount numeric not null default 0,
  total_amount numeric not null default 0,
  memo text not null default '',
  source_quotation_id uuid references public.quotations(id) on delete set null,
  source_sample_id uuid references public.samples(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sales_records_client_id_idx on public.sales_records(client_id);
create index if not exists sales_records_sale_date_idx on public.sales_records(sale_date);

create table if not exists public.sales_record_items (
  id uuid primary key default gen_random_uuid(),
  sales_record_id uuid not null references public.sales_records(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null default '',
  quantity numeric not null default 0,
  unit_price numeric not null default 0,
  discount_amount numeric not null default 0,
  supply_amount numeric not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sales_record_items_sales_record_id_idx on public.sales_record_items(sales_record_id);

drop trigger if exists trg_sales_records_updated_at on public.sales_records;
create trigger trg_sales_records_updated_at before update on public.sales_records
  for each row execute procedure set_updated_at();
drop trigger if exists trg_sales_record_items_updated_at on public.sales_record_items;
create trigger trg_sales_record_items_updated_at before update on public.sales_record_items
  for each row execute procedure set_updated_at();

alter table public.sales_records enable row level security;
alter table public.sales_record_items enable row level security;

drop policy if exists "sales_records_select" on public.sales_records;
drop policy if exists "sales_records_insert" on public.sales_records;
drop policy if exists "sales_records_update" on public.sales_records;
drop policy if exists "sales_records_delete" on public.sales_records;

create policy "sales_records_select" on public.sales_records
  for select using (has_menu_permission('sales_records', 'view'));
create policy "sales_records_insert" on public.sales_records
  for insert with check (has_menu_permission('sales_records', 'create'));
create policy "sales_records_update" on public.sales_records
  for update using (has_menu_permission('sales_records', 'edit')) with check (has_menu_permission('sales_records', 'edit'));
-- 삭제는 관리자만 허용 (요청사항: 삭제 권한은 관리자/허용된 사용자만)
create policy "sales_records_delete" on public.sales_records
  for delete using (is_admin() or has_menu_permission('sales_records', 'delete'));

drop policy if exists "sales_record_items_select" on public.sales_record_items;
drop policy if exists "sales_record_items_insert" on public.sales_record_items;
drop policy if exists "sales_record_items_update" on public.sales_record_items;
drop policy if exists "sales_record_items_delete" on public.sales_record_items;

create policy "sales_record_items_select" on public.sales_record_items
  for select using (has_menu_permission('sales_records', 'view'));
create policy "sales_record_items_insert" on public.sales_record_items
  for insert with check (has_menu_permission('sales_records', 'create'));
create policy "sales_record_items_update" on public.sales_record_items
  for update using (has_menu_permission('sales_records', 'edit')) with check (has_menu_permission('sales_records', 'edit'));
create policy "sales_record_items_delete" on public.sales_record_items
  for delete using (is_admin() or has_menu_permission('sales_records', 'delete'));

revoke all on table public.sales_records from anon;
revoke all on table public.sales_record_items from anon;
grant select, insert, update, delete on table public.sales_records to authenticated;
grant select, insert, update, delete on table public.sales_record_items to authenticated;

-- 사이드바에 신규 메뉴 추가
do $$
begin
  if not exists (select 1 from public.app_menus where menu_key = 'sales_records') then
    insert into public.app_menus (menu_key, menu_name, icon_key, sort_order, is_active, is_protected, level, is_page)
    values ('sales_records', '판매실적 등록', 'Receipt', 8, true, false, 1, true);
  end if;
end $$;

-- 확인:
--   select * from public.sales_records limit 5;
--   select menu_key, menu_name from public.app_menus where menu_key = 'sales_records';
