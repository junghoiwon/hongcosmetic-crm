-- ============================================================
-- 샘플 발송 다중 품목 지원 (sample_items)
-- ============================================================
-- samples(발송 기본정보: 거래처/발송일/운송사/송장번호/도착예정일/후속연락일 등)는
-- 기존 구조(jsonb) 그대로 유지합니다. 이 테이블은 한 번의 발송에 포함된
-- "품목"들을 저장합니다. 기존에 저장된 단일 품목 샘플 데이터는 삭제하지
-- 않고, sample_items가 없으면 samples.data(productName/quantity)를 그대로
-- 보여주는 방식으로 호환성을 유지합니다.

create table if not exists public.sample_items (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null default '',
  quantity numeric not null default 0,
  note text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sample_items_sample_id_idx on public.sample_items(sample_id);

drop trigger if exists trg_sample_items_updated_at on public.sample_items;
create trigger trg_sample_items_updated_at before update on public.sample_items
  for each row execute procedure set_updated_at();

alter table public.sample_items enable row level security;

drop policy if exists "sample_items_select" on public.sample_items;
drop policy if exists "sample_items_insert" on public.sample_items;
drop policy if exists "sample_items_update" on public.sample_items;
drop policy if exists "sample_items_delete" on public.sample_items;

-- 샘플 관리 권한에 종속
create policy "sample_items_select" on public.sample_items
  for select using (has_menu_permission('samples', 'view'));
create policy "sample_items_insert" on public.sample_items
  for insert with check (has_menu_permission('samples', 'create'));
create policy "sample_items_update" on public.sample_items
  for update using (has_menu_permission('samples', 'edit')) with check (has_menu_permission('samples', 'edit'));
create policy "sample_items_delete" on public.sample_items
  for delete using (has_menu_permission('samples', 'delete'));

revoke all on table public.sample_items from anon;
grant select, insert, update, delete on table public.sample_items to authenticated;

-- 확인:
--   select * from public.sample_items limit 5;
