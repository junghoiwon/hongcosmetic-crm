/**
 * clientStatusHistory.js
 * ------------------------------------------------------------------
 * 거래처 진행 단계(고객 상태) 변경 이력. 대시보드의 거래처별 진행
 * 타임라인에서 "언제 이 단계에 도달했는지"를 보여주는 데 사용합니다.
 * ------------------------------------------------------------------
 */
import { supabase } from "./supabaseClient";

/** 여러 거래처의 상태 이력을 한 번에 가져와 { [clientId]: [{status, changed_at}] } 형태로 반환합니다. */
export async function fetchStatusHistoryForClients(clientIds) {
  if (!clientIds || clientIds.length === 0) return {};
  const { data, error } = await supabase
    .from("client_status_history")
    .select("client_id, status, changed_at")
    .in("client_id", clientIds)
    .order("changed_at", { ascending: true });
  if (error) {
    console.error("[clientStatusHistory] 이력 조회 실패", error);
    return {};
  }
  const byClient = {};
  for (const row of data || []) {
    if (!byClient[row.client_id]) byClient[row.client_id] = [];
    byClient[row.client_id].push(row);
  }
  return byClient;
}

/** 거래처 상태가 바뀔 때 이력 한 행을 남깁니다. */
export async function recordClientStatusChange(clientId, status) {
  const { error } = await supabase.from("client_status_history").insert({ client_id: clientId, status });
  if (error) {
    console.error("[clientStatusHistory] 이력 기록 실패", error);
  }
}
