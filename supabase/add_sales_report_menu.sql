-- ============================================================
-- "판매 실적" 리포트 화면을 좌측 메뉴 목록(app_menus)에 등록합니다.
-- 다른 업무 메뉴와 동일하게 menu_permissions로 보기 권한을 위임할 수 있는
-- 일반 메뉴입니다 (관리자 하드코딩 메뉴 아님).
-- ============================================================
do $$
begin
  if not exists (select 1 from public.app_menus where menu_key = 'sales_report') then
    -- 기존 메뉴들과 순서가 겹치지 않도록 뒤쪽 메뉴들의 sort_order를 한 칸씩 밀어줍니다.
    update public.app_menus set sort_order = sort_order + 1 where sort_order >= 6;

    insert into public.app_menus (menu_key, menu_name, icon_key, sort_order, is_active, is_protected)
    values ('sales_report', '판매 실적', 'BarChart3', 6, true, false);
  end if;
end $$;

-- 확인:
--   select menu_key, menu_name, sort_order from public.app_menus order by sort_order;
