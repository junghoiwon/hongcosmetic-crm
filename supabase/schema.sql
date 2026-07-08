-- ============================================================
-- 홍코스메틱 영업관리 프로그램 — Supabase 스키마
-- ============================================================
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 실행하세요.
--
-- 설계 방침:
--   각 테이블은 (id, data jsonb, created_at, updated_at) 형태입니다.
--   화면에서 쓰는 실제 필드(회사명, 담당자 등)는 전부 data 컬럼
--   안에 들어갑니다. 프론트엔드 기능이 늘어나 필드가 추가되어도
--   테이블 구조를 다시 바꿀 필요가 없습니다.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 공통 함수: updated_at 자동 갱신
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ------------------------------------------------------------
-- 테이블 생성 매크로 (직접 반복 작성)
-- ------------------------------------------------------------

-- 1) customers (거래처)
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customers_data_gin on customers using gin (data);
drop trigger if exists trg_customers_updated_at on customers;
create trigger trg_customers_updated_at before update on customers
  for each row execute procedure set_updated_at();

-- 2) products (제품)
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_data_gin on products using gin (data);
drop trigger if exists trg_products_updated_at on products;
create trigger trg_products_updated_at before update on products
  for each row execute procedure set_updated_at();

-- 3) quotations (견적)
create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quotations_data_gin on quotations using gin (data);
drop trigger if exists trg_quotations_updated_at on quotations;
create trigger trg_quotations_updated_at before update on quotations
  for each row execute procedure set_updated_at();

-- 4) samples (샘플 발송)
create table if not exists samples (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists samples_data_gin on samples using gin (data);
drop trigger if exists trg_samples_updated_at on samples;
create trigger trg_samples_updated_at before update on samples
  for each row execute procedure set_updated_at();

-- 5) users (직원) — 담당 영업 배정, 추후 Supabase Auth 연동 대비
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists users_data_gin on users using gin (data);
drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
  for each row execute procedure set_updated_at();

-- 6) update_logs (업데이트 로그 / 활동 이력)
create table if not exists update_logs (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists update_logs_data_gin on update_logs using gin (data);
drop trigger if exists trg_update_logs_updated_at on update_logs;
create trigger trg_update_logs_updated_at before update on update_logs
  for each row execute procedure set_updated_at();

-- 7) consultations (상담 이력) — 거래처 상세 탭에서 사용
create table if not exists consultations (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists consultations_data_gin on consultations using gin (data);
drop trigger if exists trg_consultations_updated_at on consultations;
create trigger trg_consultations_updated_at before update on consultations
  for each row execute procedure set_updated_at();

-- 8) custom_countries (사용자가 직접 입력해 저장한 국가명)
create table if not exists custom_countries (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_custom_countries_updated_at on custom_countries;
create trigger trg_custom_countries_updated_at before update on custom_countries
  for each row execute procedure set_updated_at();

-- 9) settings (프로그램 설정 — 단일 레코드)
create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_settings_updated_at on settings;
create trigger trg_settings_updated_at before update on settings
  for each row execute procedure set_updated_at();

-- ============================================================
-- Realtime: 대시보드 자동 갱신에 필요한 테이블을 realtime publication에 추가
-- ============================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table customers;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table quotations;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table samples;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table consultations;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table update_logs;
    exception when duplicate_object then null; end;
  end if;
end $$;
-- 지금은 로그인 없이 anon key로 접근하는 사내 영업관리 도구이므로,
-- 우선 "모두 허용" 정책으로 열어둡니다. 추후 Supabase Auth를 붙이면
-- 아래 정책을 auth.uid() 기반으로 좁혀야 합니다. (현재는 임시 상태)

alter table customers enable row level security;
alter table products enable row level security;
alter table quotations enable row level security;
alter table samples enable row level security;
alter table users enable row level security;
alter table update_logs enable row level security;
alter table consultations enable row level security;
alter table custom_countries enable row level security;
alter table settings enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'customers','products','quotations','samples','users',
    'update_logs','consultations','custom_countries','settings'
  ]
  loop
    execute format(
      'drop policy if exists "allow_all_%1$s" on %1$s;', t
    );
    execute format(
      'create policy "allow_all_%1$s" on %1$s for all using (true) with check (true);', t
    );
  end loop;
end $$;
