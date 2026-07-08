/**
 * session.js
 * ------------------------------------------------------------------
 * 실제 로그인 시스템(Supabase Auth 등)이 붙기 전까지, 이 브라우저를
 * 쓰는 사람이 누구인지/어떤 권한인지 시뮬레이션하는 아주 가벼운 모듈.
 * Settings 등 관리자 전용 메뉴를 가리는 데 사용하고, 활동 로그에
 * "누가" 했는지 기록하는 데 사용합니다.
 * 나중에 실제 인증을 붙일 때는 이 파일만 교체하면 됩니다.
 * ------------------------------------------------------------------
 */

const KEY = "cosmo_crm_v1:session";

export const ROLES = ["admin", "sales", "logistics", "production", "viewer"];

export const ROLE_LABELS = {
  admin: "관리자",
  sales: "영업",
  logistics: "물류",
  production: "생산",
  viewer: "읽기전용",
};

export const DEFAULT_SESSION = { name: "김영업", role: "admin" };

export function getSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SESSION;
    return { ...DEFAULT_SESSION, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SESSION;
  }
}

export function setSession(session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function isAdmin(session) {
  return session?.role === "admin";
}
