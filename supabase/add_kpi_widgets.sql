-- ============================================================
-- 대시보드 KPI 카드 5종을 위젯으로 등록합니다.
-- ("진행중 거래처"는 기존 "진행 중인 상담" 카드와 지표가 동일해 중복 추가하지 않았습니다.)
-- ============================================================
do $$
declare
  widgets record;
begin
  for widgets in
    select * from (values
      ('kpi_new_inquiries_today', 0,   1290, 220, 110, 20),
      ('kpi_quote_amount_month',  230, 1290, 220, 110, 21),
      ('kpi_contract_amount_month',460,1290, 220, 110, 22),
      ('kpi_shipment_pending',    690, 1290, 220, 110, 23),
      ('kpi_low_stock',           920, 1290, 220, 110, 24)
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

-- 확인:
--   select content, x, y from public.dashboard_layout_items where content like 'kpi_%';
