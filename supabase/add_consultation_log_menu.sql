-- ============================================================
-- 상담·미팅일지 신규 메뉴 (consultation_log)
-- ============================================================
-- 기존 consultations 테이블을 그대로 확장해서 사용합니다(신규 테이블 생성
-- 없음). 화면에서 쓰는 새 필드(시간/구분/연락방법/제목/후속상태/중요도/
-- 담당 상담원/첨부파일 등)는 jsonb 컬럼에 그대로 저장되므로 스키마 변경이
-- 필요 없습니다. 대시보드 후속연락 위젯과 동일한 nextContactDate 필드를
-- 그대로 사용해 데이터를 중복 저장하지 않고 하나의 원본을 공유합니다.

-- 1) 사이드바에 별도 메뉴 추가
do $$
begin
  if not exists (select 1 from public.app_menus where menu_key = 'consultation_log') then
    insert into public.app_menus (menu_key, menu_name, icon_key, sort_order, is_active, is_protected)
    values ('consultation_log', '상담·미팅일지', 'MessagesSquare', 3, true, false);
  end if;
end $$;

-- 2) consultations 테이블 접근 권한: 기존 '거래처(clients)' 권한 보유자는
--    그대로 접근 가능하고, 새 '상담·미팅일지' 메뉴 권한을 별도로 받은
--    사용자도 접근할 수 있도록 OR 조건으로 확장합니다. (기존 권한 축소 없음)
drop policy if exists "consultations_select" on public.consultations;
drop policy if exists "consultations_insert" on public.consultations;
drop policy if exists "consultations_update" on public.consultations;
drop policy if exists "consultations_delete" on public.consultations;

create policy "consultations_select" on public.consultations
  for select using (has_menu_permission('clients', 'view') or has_menu_permission('consultation_log', 'view'));
create policy "consultations_insert" on public.consultations
  for insert with check (has_menu_permission('clients', 'create') or has_menu_permission('consultation_log', 'create'));
create policy "consultations_update" on public.consultations
  for update
  using (has_menu_permission('clients', 'edit') or has_menu_permission('consultation_log', 'edit'))
  with check (has_menu_permission('clients', 'edit') or has_menu_permission('consultation_log', 'edit'));
create policy "consultations_delete" on public.consultations
  for delete using (has_menu_permission('clients', 'delete') or has_menu_permission('consultation_log', 'delete'));

-- 확인:
--   select menu_key, menu_name from public.app_menus where menu_key = 'consultation_log';
