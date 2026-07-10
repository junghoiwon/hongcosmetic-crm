/**
 * clientContacts.js
 * ------------------------------------------------------------------
 * 거래처 담당자 여러 명 등록 CRUD. 거래처 자체의 단일 담당자 필드
 * (contactName/phone/email 등)와는 별개로, 추가 담당자 목록을 관리합니다.
 * ------------------------------------------------------------------
 */
import { supabase } from "./supabaseClient";

const COLUMNS = "id, client_id, name, position, phone, email, kakao, wechat, whatsapp, memo, is_primary, created_at, updated_at";

export async function fetchClientContacts(clientId) {
  const { data, error } = await supabase
    .from("client_contacts")
    .select(COLUMNS)
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[clientContacts] 담당자 목록 조회 실패", error);
    return [];
  }
  return data || [];
}

export async function createClientContact(clientId, patch) {
  const { data, error } = await supabase
    .from("client_contacts")
    .insert({ client_id: clientId, ...patch })
    .select(COLUMNS)
    .single();
  if (error) {
    console.error("[clientContacts] 담당자 추가 실패", error);
    throw error;
  }
  return data;
}

export async function updateClientContact(id, patch) {
  const { data, error } = await supabase
    .from("client_contacts")
    .update(patch)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) {
    console.error("[clientContacts] 담당자 수정 실패", error);
    throw error;
  }
  return data;
}

export async function deleteClientContact(id) {
  const { error } = await supabase.from("client_contacts").delete().eq("id", id);
  if (error) {
    console.error("[clientContacts] 담당자 삭제 실패", error);
    throw error;
  }
}
