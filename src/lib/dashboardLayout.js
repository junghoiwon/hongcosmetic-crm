/**
 * dashboardLayout.js
 * ------------------------------------------------------------------
 * 대시보드 레이아웃 편집 화면(관리자 전용)과 대시보드 화면이 공통으로
 * 사용하는 dashboard_layout_items CRUD 함수 모음.
 * ------------------------------------------------------------------
 */
import { supabase } from "./supabaseClient";

const COLUMNS = "id, item_type, content, image_url, x, y, width, height, style_json, sort_order, is_active";

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
