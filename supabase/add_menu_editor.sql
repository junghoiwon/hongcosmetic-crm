-- ============================================================
-- "메뉴 편집" 화면 자체를 좌측 메뉴 목록(app_menus)에 등록합니다.
-- update_v2.sql 실행 이후, 메뉴 편집 화면을 추가하면서 필요해진 SQL입니다.
-- ============================================================
insert into public.app_menus (menu_key, menu_name, icon_key, sort_order, is_active, is_protected) values
  ('menu-editor', '메뉴 편집', 'ListOrdered', 10, true, true)
on conflict (menu_key) do update set is_protected = true;

-- 확인:
--   select menu_key, menu_name, icon_key, sort_order, is_protected from public.app_menus order by sort_order;
