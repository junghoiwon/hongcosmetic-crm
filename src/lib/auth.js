/**
 * auth.js
 * ------------------------------------------------------------------
 * Supabase Auth(이메일/비밀번호) 로그인 관련 함수 모음.
 * 컴포넌트는 이 파일의 함수만 사용하고, supabase.auth를 직접 다루지
 * 않습니다.
 * ------------------------------------------------------------------
 */
import { supabase } from "./supabaseClient";

/** 이메일/비밀번호로 로그인합니다. 실패 시 에러를 던집니다. */
export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** 로그아웃합니다. */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** 현재 브라우저에 저장된 로그인 세션을 가져옵니다. 없으면 null. */
export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("[auth] 세션 조회 실패", error);
    return null;
  }
  return data.session;
}

/**
 * 로그인/로그아웃/토큰 갱신 등 인증 상태가 바뀔 때마다 callback(session)을 호출합니다.
 * 반환된 함수를 호출하면 구독이 해제됩니다.
 */
export function onAuthStateChange(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => subscription.unsubscribe();
}
