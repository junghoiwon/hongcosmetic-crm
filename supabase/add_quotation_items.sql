-- ============================================================
-- 견적서 다중 품목 지원 (quotation_items)
-- ============================================================
-- quotations(견적서 기본정보: 거래처/견적일/상태/통화/합계/메모 등)는 기존
-- 구조(jsonb) 그대로 유지합니다. 이 테이블은 한 견적서에 속한 "품목"들을
-- 저장합니다. 제품명/단가는 견적 등록 당시 값을 스냅샷으로 저장해서,
-- 이후 제품 정보가 바뀌어도 과거 견적서 내용은 바뀌지 않습니다.
-- 기존에 단일 품목으로 저장된 과거 견적서는 삭제하지 않고, 화면에서
-- quotation_items가 없으면 기존 quotations.data(productId/quantity/unitPrice)를
-- 그대로 보여주는 방식으로 호환성을 유지합니다.

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null default '',
  spec text not null default '',
  quantity numeric not null default 0,
  unit_price numeric not null default 0,
  discount_rate numeric not null default 0,
  discount_amount numeric not null default 0,
  supply_amount numeric not null default 0,
  memo text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quotation_items_quotation_id_idx on public.quotation_items(quotation_id);

drop trigger if exists trg_quotation_items_updated_at on public.quotation_items;
create trigger trg_quotation_items_updated_at before update on public.quotation_items
  for each row execute procedure set_updated_at();

alter table public.quotation_items enable row level security;

drop policy if exists "quotation_items_select" on public.quotation_items;
drop policy if exists "quotation_items_insert" on public.quotation_items;
drop policy if exists "quotation_items_update" on public.quotation_items;
drop policy if exists "quotation_items_delete" on public.quotation_items;

-- 견적 관리 권한에 종속
create policy "quotation_items_select" on public.quotation_items
  for select using (has_menu_permission('quotes', 'view'));
create policy "quotation_items_insert" on public.quotation_items
  for insert with check (has_menu_permission('quotes', 'create'));
create policy "quotation_items_update" on public.quotation_items
  for update using (has_menu_permission('quotes', 'edit')) with check (has_menu_permission('quotes', 'edit'));
create policy "quotation_items_delete" on public.quotation_items
  for delete using (has_menu_permission('quotes', 'delete'));

revoke all on table public.quotation_items from anon;
grant select, insert, update, delete on table public.quotation_items to authenticated;

-- 확인:
--   select * from public.quotation_items limit 5;
