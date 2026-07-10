-- ============================================================
-- 거래처 담당자 다중 등록 (client_contacts)
-- ============================================================
-- 기존 customers의 단일 담당자 필드(contactName/phone/email/kakao/wechat/
-- whatsapp)는 그대로 유지합니다. 이 테이블은 "추가" 담당자들을 위한
-- 별도 목록입니다 (거래처 상세 화면에서 관리).

create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.customers(id) on delete cascade,
  name text not null default '',
  position text not null default '',
  phone text not null default '',
  email text not null default '',
  kakao text not null default '',
  wechat text not null default '',
  whatsapp text not null default '',
  memo text not null default '',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_contacts_client_id_idx on public.client_contacts(client_id);

drop trigger if exists trg_client_contacts_updated_at on public.client_contacts;
create trigger trg_client_contacts_updated_at before update on public.client_contacts
  for each row execute procedure set_updated_at();

alter table public.client_contacts enable row level security;

drop policy if exists "client_contacts_select" on public.client_contacts;
drop policy if exists "client_contacts_insert" on public.client_contacts;
drop policy if exists "client_contacts_update" on public.client_contacts;
drop policy if exists "client_contacts_delete" on public.client_contacts;

-- 고객관리 권한에 종속 (customers/consultations와 동일한 방식)
create policy "client_contacts_select" on public.client_contacts
  for select using (has_menu_permission('clients', 'view'));
create policy "client_contacts_insert" on public.client_contacts
  for insert with check (has_menu_permission('clients', 'create'));
create policy "client_contacts_update" on public.client_contacts
  for update using (has_menu_permission('clients', 'edit')) with check (has_menu_permission('clients', 'edit'));
create policy "client_contacts_delete" on public.client_contacts
  for delete using (has_menu_permission('clients', 'delete'));

revoke all on table public.client_contacts from anon;
grant select, insert, update, delete on table public.client_contacts to authenticated;

-- 확인:
--   select * from public.client_contacts limit 5;
