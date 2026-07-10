/**
 * scheduleEvents.js
 * ------------------------------------------------------------------
 * 대시보드 "일정" 위젯(오늘/이번주)에서 쓰는 팀 공유 일정 CRUD.
 * ------------------------------------------------------------------
 */
import { supabase } from "./supabaseClient";

const COLUMNS = "id, title, event_date, event_type, client_id, memo, created_by, created_at";

export async function fetchScheduleEvents() {
  const { data, error } = await supabase
    .from("schedule_events")
    .select(COLUMNS)
    .order("event_date", { ascending: true });
  if (error) {
    console.error("[scheduleEvents] 조회 실패", error);
    return [];
  }
  return data || [];
}

export async function createScheduleEvent(patch) {
  const { data, error } = await supabase.from("schedule_events").insert(patch).select(COLUMNS).single();
  if (error) {
    console.error("[scheduleEvents] 등록 실패", error);
    throw error;
  }
  return data;
}

export async function updateScheduleEvent(id, patch) {
  const { data, error } = await supabase.from("schedule_events").update(patch).eq("id", id).select(COLUMNS).single();
  if (error) {
    console.error("[scheduleEvents] 수정 실패", error);
    throw error;
  }
  return data;
}

export async function deleteScheduleEvent(id) {
  const { error } = await supabase.from("schedule_events").delete().eq("id", id);
  if (error) {
    console.error("[scheduleEvents] 삭제 실패", error);
    throw error;
  }
}
