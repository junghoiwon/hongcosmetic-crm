-- ============================================================
-- 홍코스메틱 영업관리 프로그램 — 2차 업데이트(6단계) SQL
-- ============================================================
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 실행하세요.
-- (security_update_v1.sql 이 이미 적용되어 있다는 전제 하에 동작합니다.)
--
-- 이 파일이 하는 일:
--   1) app_menus: 아이콘/보호메뉴/향후 소메뉴 확장용 컬럼 추가,
--      사용자관리·화면편집·설정을 "삭제(숨김) 불가" 메뉴로 등록
--   2) dashboard_layout_items: item_type에 'widget' 허용 + 기존
--      대시보드 위젯(통계 카드 등) 7종 기본 좌표로 시드
--   3) client_status_history 신규 테이블 (거래처 진행 타임라인용)
--      + 기존 거래처 현재 상태를 초기 이력으로 백필
-- ============================================================

-- ------------------------------------------------------------
-- 1) app_menus 확장
-- ------------------------------------------------------------
alter table public.app_menus add column if not exists icon_key text not null default 'Circle';
alter table public.app_menus add column if not exists is_protected boolean not null default false;
alter table public.app_menus add column if not exists parent_menu_key text;

-- 삭제(숨김)를 막고 싶은 보호 메뉴는 is_active를 강제로 true로 유지시킵니다.
alter table public.app_menus drop constraint if exists app_menus_protected_active;
alter table public.app_menus add constraint app_menus_protected_active check (not is_protected or is_active);

-- 기존 7개 메뉴에 아이콘 매핑 (Sidebar.jsx에서 쓰던 아이콘과 동일하게)
update public.app_menus set icon_key = 'LayoutGrid' where menu_key = 'dashboard';
update public.app_menus set icon_key = 'Building2' where menu_key = 'clients';
update public.app_menus set icon_key = 'FlaskConical' where menu_key = 'products';
update public.app_menus set icon_key = 'FileText' where menu_key = 'quotes';
update public.app_menus set icon_key = 'PackageOpen' where menu_key = 'samples';
update public.app_menus set icon_key = 'History' where menu_key = 'logs';
update public.app_menus set icon_key = 'Settings' where menu_key = 'settings';

-- 설정은 삭제(숨김) 불가 메뉴로 지정
update public.app_menus set is_protected = true where menu_key = 'settings';

-- 사용자관리 / 화면편집은 app_menus에 없었으므로 새로 등록합니다.
-- (실제 접근 권한은 여전히 role='admin' 하드코딩으로 판단하며, 이 테이블은
--  이름/아이콘/순서/표시여부 같은 "화면 표시" 정보만 관리합니다.)
insert into public.app_menus (menu_key, menu_name, icon_key, sort_order, is_active, is_protected) values
  ('users', '사용자관리', 'UserCog', 8, true, true),
  ('layout', '화면 편집', 'LayoutTemplate', 9, true, true)
on conflict (menu_key) do update set is_protected = true;

-- ------------------------------------------------------------
-- 2) dashboard_layout_items: 위젯 타입 허용 + 기본 위젯 시드
-- ------------------------------------------------------------
alter table public.dashboard_layout_items drop constraint if exists dashboard_layout_items_item_type_check;
alter table public.dashboard_layout_items add constraint dashboard_layout_items_item_type_check
  check (item_type in ('text', 'image', 'shape', 'widget'));

do $$
declare
  w record;
  widgets record;
begin
  for widgets in
    select * from (values
      ('stat_clients',      0,   0, 270, 110, 1),
      ('stat_active',     290,   0, 270, 110, 2),
      ('stat_samples',    580,   0, 270, 110, 3),
      ('stat_quotes',     870,   0, 270, 110, 4),
      ('hot_clients',       0, 130, 570, 320, 5),
      ('today_followups', 590, 130, 570, 320, 6),
      ('recent_updates',    0, 470,1160, 360, 7)
    ) as t(widget_key, x, y, width, height, sort_order)
  loop
    if not exists (
      select 1 from public.dashboard_layout_items
      where item_type = 'widget' and content = widgets.widget_key
    ) then
      insert into public.dashboard_layout_items
        (item_type, content, x, y, width, height, sort_order, is_active)
      values
        ('widget', widgets.widget_key, widgets.x, widgets.y, widgets.width, widgets.height, widgets.sort_order, true);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3) client_status_history (거래처 진행 타임라인)
-- ------------------------------------------------------------
create table if not exists public.client_status_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.customers(id) on delete cascade,
  status text not null,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists client_status_history_client_id_idx on public.client_status_history(client_id);

alter table public.client_status_history enable row level security;

drop policy if exists "client_status_history_select" on public.client_status_history;
drop policy if exists "client_status_history_insert" on public.client_status_history;
drop policy if exists "client_status_history_delete" on public.client_status_history;

create policy "client_status_history_select" on public.client_status_history
  for select using (has_menu_permission('clients', 'view'));
create policy "client_status_history_insert" on public.client_status_history
  for insert with check (has_menu_permission('clients', 'create') or has_menu_permission('clients', 'edit'));
create policy "client_status_history_delete" on public.client_status_history
  for delete using (has_menu_permission('clients', 'delete'));

revoke all on table public.client_status_history from anon;
grant select, insert, delete on table public.client_status_history to authenticated;

-- 기존 거래처는 이력이 없으니, 현재 상태를 최초 이력 1건으로 백필합니다.
-- (이 시점 이전의 실제 단계별 날짜는 알 수 없어 "현재 상태"만 표시됩니다.)
insert into public.client_status_history (client_id, status, changed_at)
select c.id, c.data->>'status', c.updated_at
from public.customers c
where c.data->>'status' is not null
  and not exists (
    select 1 from public.client_status_history h where h.client_id = c.id
  );

-- ============================================================
-- 끝. 실행 후 확인:
--   select menu_key, menu_name, icon_key, is_protected, is_active from public.app_menus order by sort_order;
--   select item_type, content, x, y, width, height from public.dashboard_layout_items where item_type = 'widget';
--   select client_id, status, changed_at from public.client_status_history order by changed_at desc limit 20;
-- ============================================================
