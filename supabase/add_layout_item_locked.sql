-- ============================================================
-- 화면 편집기 요소 잠금(locked) 지원
-- ============================================================
-- 잠긴 요소는 화면 편집기 캔버스에서 드래그로 움직이거나 크기를
-- 바꿀 수 없습니다(실수로 위치가 틀어지는 것 방지). 우측 속성
-- 패널에서 토글로 켜고 끌 수 있습니다.

alter table public.dashboard_layout_items add column if not exists locked boolean not null default false;

-- 확인:
--   select id, item_type, name, locked from public.dashboard_layout_items;
