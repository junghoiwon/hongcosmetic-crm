-- ============================================================
-- 일정 캘린더 신규 메뉴 (calendar)
-- ============================================================
-- schedule_events(기존 일정 위젯 테이블)를 그대로 사용하고, 상담일지
-- 후속연락일/견적일/샘플 발송일·후속연락일은 원본 테이블에서 그대로
-- 읽어와 화면에서만 합쳐서 보여줍니다(별도 테이블/중복 저장 없음).

do $$
begin
  if not exists (select 1 from public.app_menus where menu_key = 'calendar') then
    insert into public.app_menus (menu_key, menu_name, icon_key, sort_order, is_active, is_protected, level, is_page)
    values ('calendar', '일정 캘린더', 'CalendarDays', 7, true, false, 1, true);
  end if;
end $$;

-- 확인:
--   select menu_key, menu_name from public.app_menus where menu_key = 'calendar';
