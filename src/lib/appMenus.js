/**
 * appMenus.js
 * ------------------------------------------------------------------
 * 좌측 사이드바 메뉴 구성(app_menus) CRUD.
 * Sidebar가 메뉴를 동적으로 그릴 때, 그리고 메뉴 편집 화면(관리자 전용)이
 * 이름/아이콘/순서/표시여부를 바꿀 때 공통으로 사용합니다.
 * ------------------------------------------------------------------
 */
import { supabase } from "./supabaseClient";

const COLUMNS = "id, menu_key, menu_name, icon_key, color, sort_order, is_active, is_protected, parent_menu_key";

/** 숨김 메뉴를 포함한 전체 메뉴 목록을 가져옵니다. */
export async function fetchAllAppMenus() {
  const { data, error } = await supabase
    .from("app_menus")
    .select(COLUMNS)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[appMenus] 메뉴 목록 조회 실패", error);
    return [];
  }
  return data || [];
}

/** 메뉴 하나를 수정합니다 (이름/아이콘/표시여부 등). */
export async function updateAppMenu(id, patch) {
  const { data, error } = await supabase.from("app_menus").update(patch).eq("id", id).select(COLUMNS).single();
  if (error) {
    console.error("[appMenus] 메뉴 수정 실패", error);
    throw error;
  }
  return data;
}

/** 정렬된 id 배열을 받아 sort_order를 순서대로 다시 부여합니다. */
export async function reorderAppMenus(orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) => supabase.from("app_menus").update({ sort_order: index }).eq("id", id))
  );
}
