-- ============================================================
-- 3단계 사이드바 메뉴 구조 (app_menus 확장)
-- ============================================================
-- 새 테이블을 만들지 않고 기존 app_menus를 확장합니다. parent_menu_key는
-- 이미 있던 컬럼(그동안 미사용)을 실제로 사용하기 시작하고, level/is_page를
-- 추가합니다.
--   level: 1=대분류, 2=중분류, 3=소분류(실제 화면)
--   is_page: 실제로 클릭해서 이동하는 화면이면 true, 그냥 펼침/접힘만
--            하는 상위 분류(그룹 헤더)면 false
-- 기존에 등록된 모든 메뉴는 지금처럼 최상위(level=1)이면서 실제 화면
-- (is_page=true)으로 그대로 유지되어, 이 마이그레이션만으로는 현재
-- 사이드바 모양이 바뀌지 않습니다. 대/중분류로 묶는 것은 관리자가
-- 메뉴 편집 화면에서 원할 때 직접 구성합니다.

alter table public.app_menus add column if not exists level int not null default 1;
alter table public.app_menus add column if not exists is_page boolean not null default true;

create index if not exists app_menus_parent_menu_key_idx on public.app_menus(parent_menu_key);

-- 확인:
--   select menu_key, parent_menu_key, level, is_page, sort_order from public.app_menus order by sort_order;
