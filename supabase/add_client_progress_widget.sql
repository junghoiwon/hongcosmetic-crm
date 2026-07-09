-- ============================================================
-- 대시보드에 "거래처 진행 현황"(지하철 노선도 스타일 타임라인) 위젯을
-- 추가합니다. update_v2.sql 실행 이후, 이 기능을 만들면서 필요해진 SQL.
-- ============================================================
insert into public.dashboard_layout_items
  (item_type, content, x, y, width, height, sort_order, is_active)
select 'widget', 'client_progress_timeline', 0, 850, 1160, 420, 8, true
where not exists (
  select 1 from public.dashboard_layout_items
  where item_type = 'widget' and content = 'client_progress_timeline'
);

-- 확인:
--   select content, x, y, width, height from public.dashboard_layout_items where item_type = 'widget' order by sort_order;
