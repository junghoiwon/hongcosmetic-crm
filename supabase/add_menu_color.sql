-- ============================================================
-- 메뉴별 색상 지정을 위한 컬럼 추가 (메뉴 편집 고도화)
-- ============================================================
alter table public.app_menus add column if not exists color text;

-- 확인:
--   select menu_key, menu_name, color from public.app_menus order by sort_order;
