/**
 * adminUsers.js
 * ------------------------------------------------------------------
 * 사용자관리 화면(관리자 전용)에서만 사용하는 함수 모음.
 * 로그인 계정 생성/삭제는 admin-create-user Edge Function을 통해서만
 * 수행합니다 — service role key는 Edge Function 내부(서버 측)에만
 * 존재하고 브라우저에는 절대 노출되지 않습니다.
 * ------------------------------------------------------------------
 */
import { supabase } from "./supabaseClient";

/** 모든 사용자 프로필을 가져옵니다. (관리자만 RLS를 통과) */
export async function fetchAllProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, name, email, department, position, role, is_active, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[adminUsers] 사용자 목록 조회 실패", error);
    return [];
  }
  return data || [];
}

/** 권한 관리 화면에 표시할 메뉴 목록을 가져옵니다. */
export async function fetchAppMenus() {
  const { data, error } = await supabase
    .from("app_menus")
    .select("id, menu_key, menu_name, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[adminUsers] 메뉴 목록 조회 실패", error);
    return [];
  }
  return data || [];
}

/** 특정 사용자의 메뉴 권한 행을 가져옵니다. */
export async function fetchMenuPermissionsForUser(userId) {
  const { data, error } = await supabase
    .from("menu_permissions")
    .select("id, menu_key, can_view, can_create, can_edit, can_delete")
    .eq("user_id", userId);
  if (error) {
    console.error("[adminUsers] 사용자 권한 조회 실패", error);
    return [];
  }
  return data || [];
}

/** 특정 사용자의 메뉴 권한을 통째로 저장합니다 (menu_key 기준 upsert). */
export async function saveMenuPermissions(userId, rows) {
  const payload = rows.map((r) => ({
    user_id: userId,
    menu_key: r.menu_key,
    can_view: r.can_view,
    can_create: r.can_create,
    can_edit: r.can_edit,
    can_delete: r.can_delete,
  }));
  const { error } = await supabase.from("menu_permissions").upsert(payload, { onConflict: "user_id,menu_key" });
  if (error) {
    console.error("[adminUsers] 권한 저장 실패", error);
    throw error;
  }
}

/** 프로필(이름/부서/직급/역할/사용여부)을 수정합니다. */
export async function updateProfile(profileId, patch) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", profileId);
  if (error) {
    console.error("[adminUsers] 프로필 수정 실패", error);
    throw error;
  }
}

async function extractFunctionErrorMessage(error) {
  try {
    if (error?.context && typeof error.context.json === "function") {
      const body = await error.context.json();
      if (body?.error) return body.error;
    }
  } catch {
    // 응답 파싱 실패 시 아래 기본 메시지로 대체합니다.
  }
  return error?.message || "요청 처리 중 오류가 발생했습니다.";
}

/** 새 로그인 계정을 생성합니다 (Edge Function 호출). */
export async function createUserAccount({ email, password, name, department, position, role }) {
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: { action: "create", email, password, name, department, position, role },
  });
  if (error) throw new Error(await extractFunctionErrorMessage(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

/** 로그인 계정을 완전히 삭제합니다 (Auth 계정 + profiles/menu_permissions 연쇄 삭제). */
export async function deleteUserAccount(userId) {
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: { action: "delete", user_id: userId },
  });
  if (error) throw new Error(await extractFunctionErrorMessage(error));
  if (data?.error) throw new Error(data.error);
  return data;
}
