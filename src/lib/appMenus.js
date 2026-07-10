/**
 * appMenus.js
 * ------------------------------------------------------------------
 * 좌측 사이드바 메뉴 구성(app_menus) CRUD.
 * Sidebar가 메뉴를 동적으로 그릴 때, 그리고 메뉴 편집 화면(관리자 전용)이
 * 이름/아이콘/순서/표시여부를 바꿀 때 공통으로 사용합니다.
 * ------------------------------------------------------------------
 */
import { supabase } from "./supabaseClient";

const COLUMNS =
  "id, menu_key, menu_name, icon_key, color, sort_order, is_active, is_protected, parent_menu_key, level, is_page";

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

/** 정렬된 id 배열을 받아 sort_order를 순서대로 다시 부여합니다. (형제 메뉴 단위로 호출) */
export async function reorderAppMenus(orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) => supabase.from("app_menus").update({ sort_order: index }).eq("id", id))
  );
}

function slugify(name) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${base || "menu"}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 새 메뉴(대/중/소분류)를 추가합니다. parentKey가 있으면 그 메뉴의 하위로,
 * level은 부모의 level+1(부모 없으면 1)로 자동 설정됩니다. level 3은 실제
 * 화면(is_page=true), level 1~2는 그냥 펼침용 분류(is_page=false)로 만듭니다.
 * 실제 화면(level 3)을 App.jsx의 페이지와 연결하려면, 별도로 개발자가
 * menu_key에 대응하는 case를 App.jsx의 renderPage()에 추가해야 합니다.
 */
export async function createAppMenu({ menuName, parentMenu, iconKey = "Circle", isPage }) {
  const level = parentMenu ? Math.min(3, (parentMenu.level || 1) + 1) : 1;
  const menu_key = slugify(menuName);
  const { data, error } = await supabase
    .from("app_menus")
    .insert({
      menu_key,
      menu_name: menuName,
      icon_key: iconKey,
      parent_menu_key: parentMenu?.menu_key || null,
      level,
      is_page: isPage ?? level === 3,
      is_active: true,
      is_protected: false,
      sort_order: 999,
    })
    .select(COLUMNS)
    .single();
  if (error) {
    console.error("[appMenus] 메뉴 추가 실패", error);
    throw error;
  }
  return data;
}

/** 메뉴를 영구 삭제합니다. 보호된 메뉴이거나 하위 메뉴가 남아있으면 막습니다. */
export async function deleteAppMenu(menu, allMenus) {
  if (menu.is_protected) throw new Error("보호된 메뉴는 삭제할 수 없습니다.");
  const hasChildren = allMenus.some((m) => m.parent_menu_key === menu.menu_key);
  if (hasChildren) throw new Error("하위 메뉴가 있는 메뉴는 먼저 하위 메뉴를 삭제하거나 이동해주세요.");
  const { error } = await supabase.from("app_menus").delete().eq("id", menu.id);
  if (error) {
    console.error("[appMenus] 메뉴 삭제 실패", error);
    throw error;
  }
}
