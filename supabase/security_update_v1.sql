-- ============================================================
-- 홍코스메틱 영업관리 프로그램 — 1차 보안 업데이트 SQL
-- ============================================================
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 실행하세요.
-- (기존 supabase/schema.sql 이 이미 적용되어 있다는 전제 하에 동작합니다.)
--
-- 이 파일이 하는 일:
--   1) profiles / menu_permissions / app_menus / dashboard_layout_items 테이블 생성
--   2) auth.users 에 새 계정이 생기면 profiles 행을 자동 생성하는 트리거 등록
--   3) is_admin() / has_menu_permission() 헬퍼 함수 생성
--   4) 기존 9개 테이블의 "allow_all(anon 전체 허용)" 정책을 제거하고,
--      로그인 + 메뉴 권한 기반 정책으로 교체
--   5) anon 롤의 테이블 권한 회수(REVOKE)
-- ============================================================

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 1) 신규 테이블
-- ============================================================

-- profiles: 로그인 계정의 프로필/역할
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  department text not null default '',
  position text not null default '',
  role text not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_user_id_idx on public.profiles(user_id);
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute procedure set_updated_at();

-- menu_permissions: 사용자별 메뉴 권한 (보기/등록/수정/삭제)
create table if not exists public.menu_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  menu_key text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, menu_key)
);
create index if not exists menu_permissions_user_id_idx on public.menu_permissions(user_id);
drop trigger if exists trg_menu_permissions_updated_at on public.menu_permissions;
create trigger trg_menu_permissions_updated_at before update on public.menu_permissions
  for each row execute procedure set_updated_at();

-- app_menus: 좌측 메뉴 목록 (권한 관리 화면에서 참조)
create table if not exists public.app_menus (
  id uuid primary key default gen_random_uuid(),
  menu_key text not null unique,
  menu_name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

-- dashboard_layout_items: 대시보드 레이아웃 편집 요소
create table if not exists public.dashboard_layout_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('text', 'image', 'shape')),
  content text,
  image_url text,
  x numeric not null default 0,
  y numeric not null default 0,
  width numeric not null default 200,
  height numeric not null default 100,
  style_json jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_dashboard_layout_items_updated_at on public.dashboard_layout_items;
create trigger trg_dashboard_layout_items_updated_at before update on public.dashboard_layout_items
  for each row execute procedure set_updated_at();

-- ============================================================
-- 2) 메뉴 시드 데이터 (현재 실제로 존재하는 화면만)
-- ============================================================
insert into public.app_menus (menu_key, menu_name, sort_order, is_active) values
  ('dashboard', '대시보드', 1, true),
  ('clients', '고객관리', 2, true),
  ('products', '제품관리', 3, true),
  ('quotes', '견적관리', 4, true),
  ('samples', '샘플관리', 5, true),
  ('logs', '업데이트 로그', 6, true),
  ('settings', '설정', 7, true)
on conflict (menu_key) do nothing;

-- settings 테이블에 초기 행이 없다면 하나 만들어둡니다.
-- (앱이 첫 로그인 시점에 관리자가 아닌 사용자 세션에서 INSERT를 시도하지 않도록,
--  기본 행을 미리 만들어 둡니다. 실제 값은 프론트엔드 기본값과 병합되어 표시됩니다.)
insert into public.settings (data)
select '{}'::jsonb
where not exists (select 1 from public.settings);

-- ============================================================
-- 3) 신규 계정 생성 시 profiles 자동 생성 트리거
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, name, email, department, position, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'department', ''),
    coalesce(new.raw_user_meta_data->>'position', ''),
    coalesce(new.raw_user_meta_data->>'role', 'viewer'),
    true
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 4) 권한 판별 헬퍼 함수 (security definer: 내부에서 RLS 우회하여
--    profiles/menu_permissions 를 조회 — 정책 재귀/순환 방지)
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

create or replace function public.has_menu_permission(p_menu_key text, p_action text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.menu_permissions mp
      join public.profiles p on p.user_id = mp.user_id and p.is_active = true
      where mp.user_id = auth.uid()
        and mp.menu_key = p_menu_key
        and (
          (p_action = 'view' and mp.can_view)
          or (p_action = 'create' and mp.can_create)
          or (p_action = 'edit' and mp.can_edit)
          or (p_action = 'delete' and mp.can_delete)
        )
    );
$$;

-- ============================================================
-- 5) RLS 활성화 + 정책
-- ============================================================

-- ---- profiles ----
alter table public.profiles enable row level security;
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert_admin" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (user_id = auth.uid() or is_admin());
create policy "profiles_insert_admin" on public.profiles
  for insert with check (is_admin());
create policy "profiles_update_admin" on public.profiles
  for update using (is_admin()) with check (is_admin());
create policy "profiles_delete_admin" on public.profiles
  for delete using (is_admin());

-- ---- menu_permissions ----
alter table public.menu_permissions enable row level security;
drop policy if exists "menu_permissions_select" on public.menu_permissions;
drop policy if exists "menu_permissions_insert_admin" on public.menu_permissions;
drop policy if exists "menu_permissions_update_admin" on public.menu_permissions;
drop policy if exists "menu_permissions_delete_admin" on public.menu_permissions;
create policy "menu_permissions_select" on public.menu_permissions
  for select using (user_id = auth.uid() or is_admin());
create policy "menu_permissions_insert_admin" on public.menu_permissions
  for insert with check (is_admin());
create policy "menu_permissions_update_admin" on public.menu_permissions
  for update using (is_admin()) with check (is_admin());
create policy "menu_permissions_delete_admin" on public.menu_permissions
  for delete using (is_admin());

-- ---- app_menus ----
alter table public.app_menus enable row level security;
drop policy if exists "app_menus_select_auth" on public.app_menus;
drop policy if exists "app_menus_insert_admin" on public.app_menus;
drop policy if exists "app_menus_update_admin" on public.app_menus;
drop policy if exists "app_menus_delete_admin" on public.app_menus;
create policy "app_menus_select_auth" on public.app_menus
  for select using (auth.uid() is not null);
create policy "app_menus_insert_admin" on public.app_menus
  for insert with check (is_admin());
create policy "app_menus_update_admin" on public.app_menus
  for update using (is_admin()) with check (is_admin());
create policy "app_menus_delete_admin" on public.app_menus
  for delete using (is_admin());

-- ---- dashboard_layout_items ----
alter table public.dashboard_layout_items enable row level security;
drop policy if exists "layout_select_auth" on public.dashboard_layout_items;
drop policy if exists "layout_insert_admin" on public.dashboard_layout_items;
drop policy if exists "layout_update_admin" on public.dashboard_layout_items;
drop policy if exists "layout_delete_admin" on public.dashboard_layout_items;
create policy "layout_select_auth" on public.dashboard_layout_items
  for select using (auth.uid() is not null);
create policy "layout_insert_admin" on public.dashboard_layout_items
  for insert with check (is_admin());
create policy "layout_update_admin" on public.dashboard_layout_items
  for update using (is_admin()) with check (is_admin());
create policy "layout_delete_admin" on public.dashboard_layout_items
  for delete using (is_admin());

-- ============================================================
-- 6) 기존 업무 테이블: allow_all 정책 제거 후 메뉴 권한 기반으로 교체
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers','products','quotations','samples','users',
    'update_logs','consultations','custom_countries','settings'
  ]
  loop
    execute format('drop policy if exists "allow_all_%1$s" on %1$s;', t);
  end loop;
end $$;

-- customers (고객관리)
drop policy if exists "customers_select" on customers;
drop policy if exists "customers_insert" on customers;
drop policy if exists "customers_update" on customers;
drop policy if exists "customers_delete" on customers;
create policy "customers_select" on customers for select using (has_menu_permission('clients','view'));
create policy "customers_insert" on customers for insert with check (has_menu_permission('clients','create'));
create policy "customers_update" on customers for update using (has_menu_permission('clients','edit')) with check (has_menu_permission('clients','edit'));
create policy "customers_delete" on customers for delete using (has_menu_permission('clients','delete'));

-- products (제품관리)
drop policy if exists "products_select" on products;
drop policy if exists "products_insert" on products;
drop policy if exists "products_update" on products;
drop policy if exists "products_delete" on products;
create policy "products_select" on products for select using (has_menu_permission('products','view'));
create policy "products_insert" on products for insert with check (has_menu_permission('products','create'));
create policy "products_update" on products for update using (has_menu_permission('products','edit')) with check (has_menu_permission('products','edit'));
create policy "products_delete" on products for delete using (has_menu_permission('products','delete'));

-- quotations (견적관리)
drop policy if exists "quotations_select" on quotations;
drop policy if exists "quotations_insert" on quotations;
drop policy if exists "quotations_update" on quotations;
drop policy if exists "quotations_delete" on quotations;
create policy "quotations_select" on quotations for select using (has_menu_permission('quotes','view'));
create policy "quotations_insert" on quotations for insert with check (has_menu_permission('quotes','create'));
create policy "quotations_update" on quotations for update using (has_menu_permission('quotes','edit')) with check (has_menu_permission('quotes','edit'));
create policy "quotations_delete" on quotations for delete using (has_menu_permission('quotes','delete'));

-- samples (샘플관리)
drop policy if exists "samples_select" on samples;
drop policy if exists "samples_insert" on samples;
drop policy if exists "samples_update" on samples;
drop policy if exists "samples_delete" on samples;
create policy "samples_select" on samples for select using (has_menu_permission('samples','view'));
create policy "samples_insert" on samples for insert with check (has_menu_permission('samples','create'));
create policy "samples_update" on samples for update using (has_menu_permission('samples','edit')) with check (has_menu_permission('samples','edit'));
create policy "samples_delete" on samples for delete using (has_menu_permission('samples','delete'));

-- consultations (거래처 상세의 상담 이력 — 고객관리 권한에 종속)
drop policy if exists "consultations_select" on consultations;
drop policy if exists "consultations_insert" on consultations;
drop policy if exists "consultations_update" on consultations;
drop policy if exists "consultations_delete" on consultations;
create policy "consultations_select" on consultations for select using (has_menu_permission('clients','view'));
create policy "consultations_insert" on consultations for insert with check (has_menu_permission('clients','create'));
create policy "consultations_update" on consultations for update using (has_menu_permission('clients','edit')) with check (has_menu_permission('clients','edit'));
create policy "consultations_delete" on consultations for delete using (has_menu_permission('clients','delete'));

-- custom_countries (거래처 등록 폼에서 직접 입력한 국가명 — 로그인 사용자면 조회 가능, 등록은 고객관리 등록 권한)
drop policy if exists "custom_countries_select" on custom_countries;
drop policy if exists "custom_countries_insert" on custom_countries;
drop policy if exists "custom_countries_update" on custom_countries;
drop policy if exists "custom_countries_delete" on custom_countries;
create policy "custom_countries_select" on custom_countries for select using (auth.uid() is not null);
create policy "custom_countries_insert" on custom_countries for insert with check (has_menu_permission('clients','create'));
create policy "custom_countries_update" on custom_countries for update using (is_admin()) with check (is_admin());
create policy "custom_countries_delete" on custom_countries for delete using (is_admin());

-- settings (프로그램 설정 — 브랜딩은 로그인한 모두가 읽어야 사이드바/타이틀이 정상 표시됨)
drop policy if exists "settings_select" on settings;
drop policy if exists "settings_insert" on settings;
drop policy if exists "settings_update" on settings;
drop policy if exists "settings_delete" on settings;
create policy "settings_select" on settings for select using (auth.uid() is not null);
create policy "settings_insert" on settings for insert with check (is_admin());
create policy "settings_update" on settings for update using (has_menu_permission('settings','edit')) with check (has_menu_permission('settings','edit'));
create policy "settings_delete" on settings for delete using (is_admin());

-- update_logs (업데이트 로그 — 조회는 logs 보기 권한, 기록은 누구나 자신의 행동을 남길 수 있어야 함)
drop policy if exists "update_logs_select" on update_logs;
drop policy if exists "update_logs_insert" on update_logs;
drop policy if exists "update_logs_update" on update_logs;
drop policy if exists "update_logs_delete" on update_logs;
create policy "update_logs_select" on update_logs for select using (has_menu_permission('logs','view'));
create policy "update_logs_insert" on update_logs for insert with check (auth.uid() is not null);
create policy "update_logs_update" on update_logs for update using (is_admin()) with check (is_admin());
create policy "update_logs_delete" on update_logs for delete using (is_admin());

-- users (담당 영업 배정용 — 현재 화면에서 미사용, 관리자 전용으로 잠가둠)
drop policy if exists "users_select" on users;
drop policy if exists "users_insert" on users;
drop policy if exists "users_update" on users;
drop policy if exists "users_delete" on users;
create policy "users_select" on users for select using (is_admin());
create policy "users_insert" on users for insert with check (is_admin());
create policy "users_update" on users for update using (is_admin()) with check (is_admin());
create policy "users_delete" on users for delete using (is_admin());

-- ============================================================
-- 7) anon 롤 권한 회수 — 로그인하지 않은 요청은 테이블 자체에 접근 불가
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers','products','quotations','samples','users',
    'update_logs','consultations','custom_countries','settings',
    'profiles','menu_permissions','app_menus','dashboard_layout_items'
  ]
  loop
    execute format('revoke all on table public.%1$s from anon;', t);
    execute format('grant select, insert, update, delete on table public.%1$s to authenticated;', t);
  end loop;
end $$;

-- ============================================================
-- 끝. 실행 후 확인:
--   select * from public.app_menus order by sort_order;
--   select * from public.profiles;  (아직 로그인 계정이 없다면 비어있는 게 정상)
-- ============================================================
