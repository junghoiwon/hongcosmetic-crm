/**
 * permissions.js
 * ------------------------------------------------------------------
 * 로그인한 사용자의 프로필(profiles)과 메뉴 권한(menu_permissions)을
 * 읽어오고, 메뉴별 보기/등록/수정/삭제 가능 여부를 판단하는 함수 모음.
 * role='admin'인 사용자는 모든 메뉴/동작에 대해 항상 허용됩니다.
 * ------------------------------------------------------------------
 */
import { supabase } from "./supabaseClient";

/** user_id(auth.uid())로 프로필 한 건을 가져옵니다. */
export async function fetchMyProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, name, email, department, position, role, is_active")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[permissions] 프로필 조회 실패", error);
    return null;
  }
  return data;
}

/** 로그인한 사용자 본인의 메뉴 권한 행을 모두 가져옵니다. */
export async function fetchMyMenuPermissions(userId) {
  const { data, error } = await supabase
    .from("menu_permissions")
    .select("menu_key, can_view, can_create, can_edit, can_delete")
    .eq("user_id", userId);

  if (error) {
    console.error("[permissions] 메뉴 권한 조회 실패", error);
    return [];
  }
  return data || [];
}

/** 관리자이면서 활성 상태인 프로필인지 확인합니다. */
export function isAdminProfile(profile) {
  return Boolean(profile?.role === "admin" && profile?.is_active);
}

/** menu_permissions 행 배열을 { [menu_key]: { view, create, edit, delete } } 형태로 변환합니다. */
export function buildPermissionMap(permissionRows) {
  const map = {};
  for (const row of permissionRows) {
    map[row.menu_key] = {
      view: row.can_view,
      create: row.can_create,
      edit: row.can_edit,
      delete: row.can_delete,
    };
  }
  return map;
}

/**
 * 특정 메뉴의 특정 동작(view/create/edit/delete)이 허용되는지 확인합니다.
 * 관리자는 permissionMap과 무관하게 항상 true.
 */
export function canAccess(profile, permissionMap, menuKey, action = "view") {
  if (isAdminProfile(profile)) return true;
  return Boolean(permissionMap?.[menuKey]?.[action]);
}
