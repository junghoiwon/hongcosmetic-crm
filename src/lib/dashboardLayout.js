/**
 * dashboardLayout.js
 * ------------------------------------------------------------------
 * 대시보드 레이아웃 편집 화면(관리자 전용)과 대시보드 화면이 공통으로
 * 사용하는 dashboard_layout_items CRUD 함수 모음.
 * ------------------------------------------------------------------
 */
import { supabase } from "./supabaseClient";

const COLUMNS = "id, item_type, content, image_url, x, y, width, height, style_json, sort_order, is_active";

/**
 * 기존 대시보드 화면(통계 카드, 발주가능성 거래처, 오늘 후속연락, 최근 업데이트)을
 * 화면 편집기에서 다루는 "위젯"으로 취급하기 위한 레지스트리.
 * item_type='widget'인 dashboard_layout_items 행의 content 컬럼에 이 key가 들어갑니다.
 * 실제 데이터/렌더링은 Dashboard.jsx가 담당하고, 여기서는 편집기에 보여줄 이름만 관리합니다.
 */
export const BUILTIN_WIDGETS = {
  stat_clients: "전체 거래처 (통계 카드)",
  stat_active: "진행 중인 상담 (통계 카드)",
  stat_samples: "샘플 발송 (통계 카드)",
  stat_quotes: "견적 발송 (통계 카드)",
  hot_clients: "발주 가능성이 높은 거래처",
  today_followups: "오늘 해야 할 후속 연락",
  recent_updates: "최근 업데이트",
  client_progress_timeline: "거래처 진행 현황 (타임라인)",
  kpi_new_inquiries_today: "오늘 신규 문의 (KPI)",
  kpi_quote_amount_month: "이번달 견적금액 (KPI)",
  kpi_contract_amount_month: "이번달 계약금액 (KPI)",
  kpi_shipment_pending: "출고대기 건수 (KPI)",
  kpi_low_stock: "재고부족 품목 (KPI)",
  schedule_widget: "일정 (오늘/이번주)",
  todo_widget: "할 일 (To-do)",
};

/** 기본 위젯들의 초기 배치 좌표 (update_v2.sql / add_client_progress_widget.sql 시드값과 동일).
 *  화면 편집기의 "기본 배치로 초기화" 버튼에서 사용합니다. */
export const WIDGET_DEFAULT_LAYOUT = {
  stat_clients: { x: 0, y: 0, width: 270, height: 110 },
  stat_active: { x: 290, y: 0, width: 270, height: 110 },
  stat_samples: { x: 580, y: 0, width: 270, height: 110 },
  stat_quotes: { x: 870, y: 0, width: 270, height: 110 },
  hot_clients: { x: 0, y: 130, width: 570, height: 320 },
  today_followups: { x: 590, y: 130, width: 570, height: 320 },
  recent_updates: { x: 0, y: 470, width: 1160, height: 360 },
  client_progress_timeline: { x: 0, y: 850, width: 1160, height: 420 },
  kpi_new_inquiries_today: { x: 0, y: 1290, width: 220, height: 110 },
  kpi_quote_amount_month: { x: 230, y: 1290, width: 220, height: 110 },
  kpi_contract_amount_month: { x: 460, y: 1290, width: 220, height: 110 },
  kpi_shipment_pending: { x: 690, y: 1290, width: 220, height: 110 },
  kpi_low_stock: { x: 920, y: 1290, width: 220, height: 110 },
  schedule_widget: { x: 0, y: 1420, width: 570, height: 320 },
  todo_widget: { x: 590, y: 1420, width: 570, height: 320 },
};

/** 요소 크기를 빠르게 맞출 수 있는 프리셋 (화면 편집기 크기 조절 보조용). */
export const SIZE_PRESETS = [
  { label: "소", width: 270, height: 110 },
  { label: "중", width: 570, height: 320 },
  { label: "대", width: 1160, height: 360 },
];

/** 대시보드 화면에서 표시할 활성 요소만 가져옵니다. */
export async function fetchLayoutItems() {
  const { data, error } = await supabase
    .from("dashboard_layout_items")
    .select(COLUMNS)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[dashboardLayout] 레이아웃 조회 실패", error);
    return [];
  }
  return data || [];
}

/** 편집 화면에서는 비활성 요소도 함께 보여줍니다. */
export async function fetchAllLayoutItemsForEditor() {
  const { data, error } = await supabase
    .from("dashboard_layout_items")
    .select(COLUMNS)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[dashboardLayout] 레이아웃 조회 실패", error);
    return [];
  }
  return data || [];
}

export async function createLayoutItem(item) {
  const { data, error } = await supabase.from("dashboard_layout_items").insert(item).select(COLUMNS).single();
  if (error) {
    console.error("[dashboardLayout] 요소 추가 실패", error);
    throw error;
  }
  return data;
}

export async function updateLayoutItem(id, patch) {
  const { data, error } = await supabase
    .from("dashboard_layout_items")
    .update(patch)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) {
    console.error("[dashboardLayout] 요소 수정 실패", error);
    throw error;
  }
  return data;
}

export async function deleteLayoutItem(id) {
  const { error } = await supabase.from("dashboard_layout_items").delete().eq("id", id);
  if (error) {
    console.error("[dashboardLayout] 요소 삭제 실패", error);
    throw error;
  }
}
