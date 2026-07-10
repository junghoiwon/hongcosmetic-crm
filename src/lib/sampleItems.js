/**
 * sampleItems.js
 * ------------------------------------------------------------------
 * 샘플 발송 품목(sample_items) CRUD. 발송 기본정보(samples)는 여전히
 * lib/db.js의 samplesDB가 담당하고, 이 파일은 품목 라인만 다룹니다.
 * ------------------------------------------------------------------
 */
import { supabase } from "./supabaseClient";

const COLUMNS = "id, sample_id, product_id, product_name, quantity, note, sort_order, created_at";

function rowToItem(row) {
  return {
    id: row.id,
    sampleId: row.sample_id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: Number(row.quantity) || 0,
    note: row.note || "",
    sortOrder: row.sort_order,
  };
}

/** 모든 샘플 발송의 품목을 한 번에 가져와 sample_id별로 묶어 반환합니다. */
export async function fetchAllSampleItems() {
  const { data, error } = await supabase
    .from("sample_items")
    .select(COLUMNS)
    .order("sample_id", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[sampleItems] 전체 조회 실패", error);
    return {};
  }
  const bySample = {};
  for (const row of data || []) {
    const item = rowToItem(row);
    if (!bySample[item.sampleId]) bySample[item.sampleId] = [];
    bySample[item.sampleId].push(item);
  }
  return bySample;
}

export async function fetchItemsForSample(sampleId) {
  const { data, error } = await supabase
    .from("sample_items")
    .select(COLUMNS)
    .eq("sample_id", sampleId)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[sampleItems] 조회 실패", error);
    return [];
  }
  return (data || []).map(rowToItem);
}

/** 샘플 발송의 품목 전체를 새 배열로 교체 저장합니다(삭제 후 재삽입). */
export async function replaceSampleItems(sampleId, items) {
  const { error: delErr } = await supabase.from("sample_items").delete().eq("sample_id", sampleId);
  if (delErr) {
    console.error("[sampleItems] 기존 품목 삭제 실패", delErr);
    throw delErr;
  }
  if (!items || items.length === 0) return [];

  const rows = items.map((it, idx) => ({
    sample_id: sampleId,
    product_id: it.productId || null,
    product_name: it.productName || "",
    quantity: Number(it.quantity) || 0,
    note: it.note || "",
    sort_order: idx,
  }));

  const { data, error } = await supabase.from("sample_items").insert(rows).select(COLUMNS);
  if (error) {
    console.error("[sampleItems] 품목 저장 실패", error);
    throw error;
  }
  return (data || []).map(rowToItem);
}
