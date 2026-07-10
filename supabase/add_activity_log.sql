-- ============================================================
-- 활동로그(관리자 전용, 삭제 불가) 기능 추가
-- ============================================================
-- 1) update_logs는 어떤 역할이든(관리자 포함) 삭제할 수 없도록 정책을 제거합니다.
--    (기존 "업데이트 로그" 화면과 새 "활동로그" 화면 둘 다 이 테이블을 사용합니다.)
drop policy if exists "update_logs_delete" on update_logs;

-- 2) "활동로그" 화면을 좌측 메뉴에 등록합니다 (관리자만 접근 — 코드에서 하드코딩 가드).
do $$
begin
  if not exists (select 1 from public.app_menus where menu_key = 'activity-log') then
    insert into public.app_menus (menu_key, menu_name, icon_key, sort_order, is_active, is_protected)
    values ('activity-log', '활동로그', 'ClipboardList', 11, true, true);
  end if;
end $$;

-- 확인:
--   select policyname from pg_policies where tablename = 'update_logs';
--   select menu_key, menu_name from public.app_menus where menu_key = 'activity-log';
