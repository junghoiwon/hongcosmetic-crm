/**
 * todos.js
 * ------------------------------------------------------------------
 * 대시보드 "할 일" 위젯에서 쓰는 개인 할 일 목록 CRUD.
 * ------------------------------------------------------------------
 */
import { supabase } from "./supabaseClient";

const COLUMNS = "id, user_id, content, is_done, sort_order, created_at";

export async function fetchMyTodos() {
  const { data, error } = await supabase
    .from("todos")
    .select(COLUMNS)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[todos] 조회 실패", error);
    return [];
  }
  return data || [];
}

export async function createTodo(content) {
  const { data, error } = await supabase.from("todos").insert({ content }).select(COLUMNS).single();
  if (error) {
    console.error("[todos] 등록 실패", error);
    throw error;
  }
  return data;
}

export async function toggleTodoDone(id, isDone) {
  const { error } = await supabase.from("todos").update({ is_done: isDone }).eq("id", id);
  if (error) {
    console.error("[todos] 완료 표시 실패", error);
    throw error;
  }
}

export async function deleteTodo(id) {
  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) {
    console.error("[todos] 삭제 실패", error);
    throw error;
  }
}
