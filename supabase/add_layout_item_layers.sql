-- ============================================================
-- 화면 편집기 레이어 패널 / 숨김 보관함 지원
-- ============================================================
-- dashboard_layout_items를 확장합니다(신규 테이블 없음).
--   name: 레이어 패널에 표시할 사용자 지정 이름 (비어있으면 화면에서 자동 생성)
--   hidden_at / hidden_by: 숨김 처리한 시각/사용자 (숨김 보관함에 표시)

alter table public.dashboard_layout_items add column if not exists name text not null default '';
alter table public.dashboard_layout_items add column if not exists hidden_at timestamptz;
alter table public.dashboard_layout_items add column if not exists hidden_by text not null default '';

-- 확인:
--   select id, item_type, name, is_active, hidden_at, hidden_by from public.dashboard_layout_items;
